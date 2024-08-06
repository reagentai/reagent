import { Observable, Observer, ReplaySubject, Subscription } from "rxjs";
import { channel } from "redux-saga";
import { cancel, getContext, put, spawn, take } from "redux-saga/effects";
import slugify, { slugifyWithCounter } from "@sindresorhus/slugify";
import { includeKeys } from "filter-obj";

import { z } from "../core/zod.js";
import { WorkflowStepRef } from "./WorkflowStep.js";
import {
  ClientEventType,
  EventType,
  type NodeDependency,
  type NodeMetadata,
  type Session,
  type Tool,
} from "./types.js";
import { InternalWorkflowRef } from "./Workflow.js";

const slugifyCounter = slugifyWithCounter();

type AnyWorkflowStepRef = WorkflowStepRef<any, any, any>;

type SagaOptions = {
  listener?: ReturnType<typeof channel>;
};

// this is the format in which the value is streamed
// by ValueProvider
type SubscribedValue<Value> = {
  session: Session;
  node: NodeMetadata;
  value: Value;
};

type InternalValueProvider<Value> = {
  dependencies: NodeDependency[];
  saga(options?: SagaOptions): () => Generator<any, Value, any>;
  map<Output>(mapper: (value: Value) => Output): ValueProvider<Output>;
} & Pick<Observable<SubscribedValue<Value>>, "subscribe">;

type ValueProvider<Value> = Pick<
  InternalValueProvider<Value>,
  "subscribe" | "map"
>;

type SubscriberProvider = {
  subscriptions: Set<any>;
};

abstract class AbstractValueProvider<Value>
  implements InternalValueProvider<Value>
{
  #ref: SubscriberProvider;
  #stream: ReplaySubject<SubscribedValue<Value>>;
  #subscription?: any;
  #subscriptionCount: number;
  __isValueProvider__: boolean;

  constructor(node: SubscriberProvider) {
    this.#ref = node;
    this.#stream = new ReplaySubject();
    this.#subscriptionCount = 0;
    this.__isValueProvider__ = true;
  }

  static isValueProvider(provider: InternalValueProvider<any>) {
    return (provider as any).__isValueProvider__;
  }

  protected next(value: SubscribedValue<Value>) {
    if (this.#subscription) {
      this.#stream.next(value);
    }
  }

  abstract get dependencies(): NodeDependency[];

  abstract saga(options: SagaOptions): () => Generator<any, Value, any>;

  abstract map<Output>(mapper: any): InternalValueProvider<Output>;

  subscribe(
    observerOrNext?:
      | Partial<Observer<SubscribedValue<Value>>>
      | ((value: SubscribedValue<Value>) => void)
      | undefined
  ): Subscription;
  subscribe(
    next?: ((value: SubscribedValue<Value>) => void) | null | undefined,
    error?: ((error: any) => void) | null | undefined,
    complete?: (() => void) | null | undefined
  ): Subscription;
  subscribe(...args: any): Subscription {
    const self = this;
    if (!self.#subscription) {
      self.#subscription = self.saga.bind(this);
      self.#ref.subscriptions.add(self.#subscription);
    }
    self.#subscriptionCount += 1;
    const subscription = self.#stream.subscribe(...args);
    const unsubscribe = subscription.unsubscribe.bind(subscription);
    Object.assign(subscription, {
      unsubscribe() {
        self.#subscriptionCount -= 1;
        if (self.#subscriptionCount == 0) {
          self.#ref.subscriptions.delete(self.#subscription);
        }
        unsubscribe();
      },
    });
    return subscription;
  }
}

class ToolProvider<Input> extends AbstractValueProvider<Tool<Input, any>> {
  #ref: AnyWorkflowStepRef;
  #tool: Omit<Tool<any, any>, "execute">;
  #output: string[] | undefined;
  constructor(
    ref: AnyWorkflowStepRef,
    options: {
      parameters: string[];
      output?: string[];
    }
  ) {
    super(ref);
    this.#ref = ref;

    this.#tool = {
      // Note: need to call `slugify` after `slugifyCounter` because
      // `slugifyCounter` uses `-` as separator instead of `_`
      name: slugify(slugifyCounter(this.#ref.node.metadata.name), {
        separator: "_",
      }),
      description: this.#ref.node.metadata.description!,
      parameters: this.#ref.node.metadata.input.pick(
        Object.fromEntries(options.parameters.map((param) => [param, true]))
      ),
    };
    this.#output = options.output;
  }

  get dependencies() {
    const self = this;
    return [
      {
        id: self.#ref.nodeId,
        type: self.#ref.node.metadata.id,
        version: self.#ref.node.metadata.version,
        field: "__tool__",
      },
    ];
  }

  *saga(_: SagaOptions = {}): any {
    const self = this;
    const session = yield getContext("session");
    const dispatch = yield getContext("dispatch");
    const outputTask = yield spawn(function* (): any {
      const res = yield take(
        (e: any) => e.type == EventType.OUTPUT && e.node.id == self.#ref.nodeId
      );
      return res.output;
    });
    return {
      session,
      node: {
        id: self.#ref.nodeId,
      },
      value: {
        ...self.#tool,
        execute: async (args: any[]) => {
          dispatch({
            type: EventType.TOOL_CALL,
            session,
            node: {
              id: self.#ref.nodeId,
            },
            input: args,
          });
          const output = await outputTask.toPromise();
          if (self.#output) {
            return includeKeys(output, self.#output);
          }
          return output;
        },
      },
      onSkipped() {
        dispatch({
          type: EventType.SKIP_RUN,
          node: {
            id: self.#ref.nodeId,
          },
        });
      },
    };
  }

  map<Output>(mapper: any): InternalValueProvider<Output> {
    throw new Error("unsupported");
  }
}

class WorkflowToolProvider<Input> extends AbstractValueProvider<
  Tool<Input, any>
> {
  #ref: InternalWorkflowRef;
  #tool: Omit<Tool<any, any>, "execute">;
  #options: { id: string; nodeId: string; input: Record<string, any> };
  constructor(
    ref: InternalWorkflowRef,
    options: {
      id: string;
      nodeId: string;
      input: Record<string, any>;
    }
  ) {
    super(ref);
    this.#ref = ref;
    this.#options = options;

    this.#tool = {
      // Note: need to call `slugify` after `slugifyCounter` because
      // `slugifyCounter` uses `-` as separator instead of `_`
      name: slugify(slugifyCounter(this.#ref.config.name), {
        separator: "_",
      }),
      description: this.#ref.config.description!,
      parameters: z.object({}),
    };
  }

  get dependencies() {
    return [];
  }

  *saga(_: SagaOptions = {}): any {
    const self = this;
    const session = yield getContext("session");
    return {
      session,
      node: {
        id: self.#options.id,
      },
      value: {
        ...self.#tool,
        execute: async (args: any[]) => {
          const run = self.#ref.emit({
            sessionId: session.id,
            events: [
              {
                type: ClientEventType.INVOKE,
                node: {
                  id: self.#options.nodeId,
                },
                input: args,
              },
            ],
          });

          const output = await run.task.toPromise();
          return { result: output };
        },
      },
      onSkipped() {},
    };
  }

  map<Output>(mapper: any): InternalValueProvider<Output> {
    throw new Error("unsupported");
  }
}

class OutputValueProvider<Output> extends AbstractValueProvider<Output> {
  #ref: AnyWorkflowStepRef;
  #field: string;
  #mapCallbacks: any | undefined;
  constructor(ref: AnyWorkflowStepRef, field: string, cbs: any[] = []) {
    super(ref);
    this.#ref = ref;
    this.#field = field;
    this.#mapCallbacks = cbs;
  }

  get dependencies() {
    const self = this;
    return [
      {
        id: self.#ref.nodeId,
        type: self.#ref.node.metadata.id,
        version: self.#ref.node.metadata.version,
        field: self.#field,
      },
    ];
  }

  *saga(options: SagaOptions = {}): any {
    const self = this;
    const action = yield take((e: any) => {
      return (
        ((e.type == EventType.OUTPUT && e.output[self.#field] != undefined) ||
          e.type == EventType.SKIP_RUN ||
          e.type == EventType.RUN_CANCELLED ||
          e.type == EventType.RUN_FAILED ||
          e.type == EventType.EXECUTE_ON_CLIENT) &&
        e.node.id == self.#ref.nodeId
      );
    });

    if (action.type != EventType.OUTPUT) {
      yield cancel();
      return;
    }
    let value = action.output[self.#field];
    for (const cb of self.#mapCallbacks) {
      value = cb(value);
    }

    if (options.listener) {
      yield put(options.listener!, {
        session: action.session,
        node: action.node,
        value,
      });
    }
    self.next({
      session: action.session,
      node: action.node,
      value,
    });
    return {
      session: action.session,
      node: action.node,
      value,
    };
  }

  map<Output>(mapper: any): InternalValueProvider<Output> {
    return new OutputValueProvider<Output>(this.#ref, this.#field, [
      ...this.#mapCallbacks,
      mapper,
    ]);
  }
}

class RenderOutputProvider<Value> extends AbstractValueProvider<Value> {
  #ref: AnyWorkflowStepRef;
  #mapCallbacks: any | undefined;
  constructor(ref: AnyWorkflowStepRef, cbs: any[] = []) {
    super(ref);
    this.#ref = ref;
    this.#mapCallbacks = cbs;
  }

  get dependencies() {
    return [
      {
        id: this.#ref.nodeId,
        type: this.#ref.node.metadata.id,
        version: this.#ref.node.metadata.version,
        field: "__render__",
      },
    ];
  }

  *saga(options: SagaOptions = {}): any {
    while (1) {
      const self = this;
      const action = yield take((e: any) => {
        return e.type == EventType.RENDER && e.node.id == self.#ref.nodeId;
      });

      let value = action.render;
      for (const cb of self.#mapCallbacks) {
        value = cb(value);
      }

      if (options.listener) {
        yield put(options.listener!, {
          session: action.session,
          node: action.node,
          value,
        });
      }
      self.next({
        session: action.session,
        node: action.node,
        value,
      });
    }
  }

  map<Output>(mapper: any): InternalValueProvider<Output> {
    return new RenderOutputProvider(this.#ref, [...this.#mapCallbacks, mapper]);
  }
}

export {
  AbstractValueProvider,
  ToolProvider,
  WorkflowToolProvider,
  OutputValueProvider,
  RenderOutputProvider,
};
export type { InternalValueProvider, ValueProvider };
