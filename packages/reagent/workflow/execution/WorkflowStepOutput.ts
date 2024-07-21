import {
  Observable,
  Observer,
  ReplaySubject,
  Subject,
  Subscription,
} from "rxjs";
import { cancel, getContext, spawn, take } from "redux-saga/effects";
import slugify, { slugifyWithCounter } from "@sindresorhus/slugify";
import { pick } from "lodash-es";

import { WorkflowStepRef } from "./WorkflowStep.js";
import { NodeDependency, NodeMetadata, Session, Tool } from "./types.js";
import { EventType } from "./event.js";

const slugifyCounter = slugifyWithCounter();

type AnyWorkflowStepRef = WorkflowStepRef<any, any, any>;

// this is the format in which the value is streamed
// by ValueProvider
type SubscribedValue<Value> = {
  session: Session;
  node: NodeMetadata;
  value: Value;
};

type InternalValueProvider<Value> = {
  dependencies: NodeDependency[];
  saga(): () => Generator<any, Value, any>;
  map<Output>(mapper: (value: Value) => Output): ValueProvider<Output>;
} & Pick<Observable<SubscribedValue<Value>>, "subscribe">;

type ValueProvider<Value> = Pick<
  InternalValueProvider<Value>,
  "subscribe" | "map"
>;

abstract class AbstractValueProvider<Value>
  implements InternalValueProvider<Value>
{
  #ref: AnyWorkflowStepRef;
  #stream: Subject<SubscribedValue<Value>>;
  #subscription?: any;
  __isValueProvider__: boolean;

  constructor(node: AnyWorkflowStepRef) {
    this.#ref = node;
    this.#stream = new ReplaySubject();
    this.__isValueProvider__ = true;
  }

  static isValueProvider(provider: AbstractValueProvider<any>) {
    return provider.__isValueProvider__;
  }

  observable() {
    const self = this;
    if (!this.#subscription) {
      this.#subscription = this.saga.bind(this);
      this.#ref.subscriptions.add(this.#subscription);
    }
    return [
      self.#stream,
      () => {
        self.#ref.subscriptions.delete(self.#subscription);
      },
    ];
  }

  protected next(value: SubscribedValue<Value>) {
    if (this.#subscription) {
      this.#stream.next(value);
    }
  }

  abstract get dependencies(): NodeDependency[];

  abstract saga(): () => Generator<any, Value, any>;

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
    if (!this.#subscription) {
      this.#subscription = this.saga.bind(this);
      this.#ref.subscriptions.add(this.#subscription);
    }
    const subscription = this.#stream.subscribe(...args);
    const unsubscribe = subscription.unsubscribe.bind(subscription);
    Object.assign(subscription, {
      unsubscribe() {
        self.#ref.subscriptions.delete(self.#subscription);
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
      name: slugify(slugifyCounter(this.#ref.node.metadata.id), {
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
    return [];
  }

  *saga(): any {
    const self = this;
    const session = yield getContext("session");
    const dispatch = yield getContext("dispatch");
    const outputTask = yield spawn(function* (): any {
      const res = yield take(
        (e: any) => e.type == "OUTPUT" && e.node.id == self.#ref.nodeId
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
            type: "TOOL_CALL_INPUT",
            session,
            node: {
              id: self.#ref.nodeId,
            },
            input: args,
          });
          const output = await outputTask.toPromise();
          if (self.#output) {
            return pick(output, self.#output);
          }
          return output;
        },
      },
      onSkipped() {
        dispatch({
          type: EventType.RUN_SKIPPED,
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

  *saga(): any {
    const self = this;
    const action = yield take((e: any) => {
      return (
        e.node.id == self.#ref.nodeId &&
        ((e.type == EventType.OUTPUT && e.output[self.#field] != undefined) ||
          e.type == EventType.RUN_COMPLETED)
      );
    });
    if (action.type == EventType.RUN_COMPLETED) {
      yield cancel();
      return;
    }
    let value = action.output[self.#field];
    for (const cb of self.#mapCallbacks) {
      value = cb(value);
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

  *saga(): any {
    while (1) {
      const self = this;
      const action = yield take((e: any) => {
        return (
          e.node.id == self.#ref.nodeId &&
          (e.type == EventType.RENDER || e.type == EventType.RUN_COMPLETED)
        );
      });
      if (action.type == EventType.RUN_SKIPPED) {
        yield cancel();
        return;
      }

      let value = action.render;
      for (const cb of self.#mapCallbacks) {
        value = cb(value);
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
  OutputValueProvider,
  RenderOutputProvider,
};
export type { InternalValueProvider, ValueProvider };
