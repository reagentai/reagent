import { all, put, call, take, getContext } from "redux-saga/effects";

import { Context } from "../core/context.js";
import { AbstractWorkflowNode } from "../core/node.js";
import { InternalWorkflowRef } from "./Workflow.js";
import {
  AbstractValueProvider,
  InternalValueProvider,
  OutputValueProvider,
  RenderOutputProvider,
  ToolProvider,
  ValueProvider,
} from "./WorkflowStepOutput.js";
import type { EdgeBindings, RenderUpdate } from "./types.js";

const TOOL_CALL_INPUT_SAGA = Symbol("TOOL_CALL_INPUT_SAGA");

type WorkflowStepOptions = {
  label?: string;
};

type EdgeBindingWithToolCall<Input> = EdgeBindings<Input> & {
  [TOOL_CALL_INPUT_SAGA]?: any;
};

class WorkflowStepRef<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
> {
  nodeId: string;
  node: AbstractWorkflowNode<Config, Input, Output>;
  config: Config;
  options: WorkflowStepOptions;
  step: WorkflowStep<Config, Input, Output>;
  bindings?: EdgeBindingWithToolCall<Input>;
  subscriptions: Set<any>;
  constructor(
    nodeId: string,
    node: AbstractWorkflowNode<Config, Input, Output>,
    config: Config,
    options: WorkflowStepOptions,
    step: WorkflowStep<Config, Input, Output>
  ) {
    this.nodeId = nodeId;
    this.node = node;
    this.config = config;
    this.options = options;
    this.step = step;
    this.subscriptions = new Set();
  }

  setBindings(bindings: EdgeBindingWithToolCall<Input>) {
    this.bindings = bindings;
  }

  get dependencies() {
    return Object.values(this.bindings || {}).flatMap((provider) => {
      return (provider as InternalValueProvider<any>).dependencies || [];
    });
  }

  async execute(options: { session: any; input: any; dispatch: any }) {
    const self = this;
    const context = self.#buildContext(options.session, options.dispatch);
    const generator = self.node.execute(context, options.input);
    const output = {};
    for await (const partialOutput of generator) {
      context.sendOutput(partialOutput);
      Object.assign(output, partialOutput);
    }
    return output as Output;
  }

  *saga() {
    const self = this;
    const subscriptions = [...self.subscriptions].map((sub) => sub());
    yield all([
      self.bindingsSaga(),
      self.invokeListenerSaga(),
      ...subscriptions,
    ]);
  }

  get invokeListenerSaga() {
    const self = this;
    return function* inputListener(): any {
      const action = yield take(
        (e: any) => e.type == "INVOKE" && e.node.id == self.nodeId
      );

      const dispatch = yield getContext("dispatch");
      const session = yield getContext("session");
      yield call(self.execute.bind(self), {
        input: action.input,
        dispatch,
        session,
      });
    };
  }

  get bindingsSaga() {
    const self = this;
    if (!self.bindings) {
      return function* reducer() {};
    }

    return function* reducer(): any {
      const session = yield getContext("session");
      const dispatch = yield getContext("dispatch");
      const context = self.#buildContext(session, dispatch);
      const sagas = Object.fromEntries(
        Object.entries(self.bindings!).map(([key, value]) => {
          return [
            key,
            (function* saga(): any {
              let output;
              if (Array.isArray(value)) {
                output = yield all(
                  value.map((v) => {
                    return (function* valueSaga(): any {
                      if (AbstractValueProvider.isValueProvider(v)) {
                        const res = yield v.saga();
                        return res.value;
                      } else {
                        return v;
                      }
                    })();
                  })
                );
              } else {
                if (AbstractValueProvider.isValueProvider(value as any)) {
                  const res = yield (
                    value as InternalValueProvider<any>
                  ).saga();
                  output = res.value;
                } else {
                  output = value;
                }
              }
              self.node.onInputEvent(context, {
                [key]: value,
              } as any);
              return output;
            })(),
          ];
        })
      );

      const input = yield all(sagas);
      if (self.bindings![TOOL_CALL_INPUT_SAGA]) {
        const toolCallInput = yield self.bindings![TOOL_CALL_INPUT_SAGA]();
        Object.assign(input, toolCallInput);
      }

      yield put({
        type: "INVOKE",
        node: {
          id: self.nodeId,
        },
        input,
      });
    };
  }

  #buildContext(
    session: Context<any, any>["session"],
    dispatch: any
  ): Context<any, any> {
    const self = this;
    const node = {
      id: self.nodeId,
    };
    return {
      session,
      node,
      config: this.config || {},
      sendOutput(output: Output) {
        dispatch({ type: "OUTPUT", session, node, output });
      },
      render(step, data) {
        // since this runs in server side,
        // render will be transpiled to only pass component id
        const stepId = step as unknown as string;
        const node = {
          id: self.nodeId,
          type: self.node.metadata.id,
          version: self.node.metadata.version,
        };
        dispatch({
          type: "RENDER",
          session,
          node,
          render: {
            step: stepId,
            data,
          },
        });
        return {
          update(data) {
            dispatch({
              type: "RENDER",
              session,
              node,
              render: {
                step: stepId,
                data,
              },
            });
          },
        };
      },
    };
  }
}

class WorkflowStep<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
> {
  #ref: WorkflowStepRef<Config, Input, Output>;
  #workflow: InternalWorkflowRef;
  // This is "phantom" field only used for type inference
  _types: { output: Output };

  constructor(
    workflow: InternalWorkflowRef,
    nodeId: string,
    node: AbstractWorkflowNode<Config, Input, Output>,
    config: Config,
    options: WorkflowStepOptions
  ) {
    this.#ref = new WorkflowStepRef(nodeId, node, config, options, this);
    this.#workflow = workflow;
    this.#workflow.addNodeRef(this.#ref);
    // @ts-expect-error
    this._types = undefined;
  }

  bind(bindings: EdgeBindingWithToolCall<Input>) {
    this.#ref.setBindings(bindings);
    this.#workflow.calculateNodeDependencies(this.#ref.nodeId);
  }

  asTool<Params extends (keyof Input)[]>(options: {
    bind?: EdgeBindings<Omit<Input, Params[number]>>;
    parameters: Params;
    output?: (keyof Output)[];
  }) {
    const self = this;
    const provider = new ToolProvider<any>(this.#ref, {
      parameters: options.parameters as any,
      output: options.output as any,
    });
    const bindings = options.bind as any;
    bindings[TOOL_CALL_INPUT_SAGA] = function* saga(): any {
      const action = yield take(
        (e: any) => e.type == "TOOL_CALL_INPUT" && e.node.id == self.#ref.nodeId
      );
      return action.input;
    };
    this.#ref.setBindings(bindings);
    this.#workflow.calculateNodeDependencies(this.#ref.nodeId);
    return provider;
  }

  get output(): {
    [K in keyof Output]: ValueProvider<Output[K]>;
  } {
    const self = this;
    // @ts-expect-error
    return new Proxy(
      {},
      {
        get(_, field: string) {
          return new OutputValueProvider(self.#ref, field);
        },
      }
    );
  }

  get renderOutput(): ValueProvider<RenderUpdate> {
    return new RenderOutputProvider(this.#ref);
  }
}

export { WorkflowStep, WorkflowStepRef };
export type { WorkflowStepOptions };
