import { ReplaySubject } from "rxjs";
import { channel, END, runSaga, stdChannel } from "redux-saga";
import { all, call, fork, getContext, take } from "redux-saga/effects";

import { WorkflowStepRef } from "./WorkflowStep.js";
import { NodeMetadata, WorkflowOutputBindings, RenderUpdate } from "./types.js";
import { uniqueId } from "../../utils/uniqueId.js";
import { EventType } from "./event.js";

type OutputEvent<Output> = {
  // session is null for session independent global values
  session: {
    id: string;
  } | null;
  node: NodeMetadata;
  value: Output;
};

enum StepStatus {
  WAITING = "WAITING",
  INVOKED = "INVOKED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

type StepState = {
  status: StepStatus;
  output: Record<string, any>;
};

type InvokeOptions<Input extends Record<string, any> = any> = {
  nodeId: string;
  input: Input;
  getStepState?: (nodeId: string) => Promise<StepState | undefined>;
  updateStepState?: (
    nodeId: string,
    state: Partial<StepState>
  ) => Promise<void>;
};

class WorkflowRun {
  #id: string;
  #nodesById: Map<string, WorkflowStepRef<any, any, any>>;
  #outputBindings?: WorkflowOutputBindings;
  #channel: ReturnType<typeof stdChannel>;
  #streams: {
    markdown: ReplaySubject<OutputEvent<string>>;
    markdownStream: ReplaySubject<
      OutputEvent<ReplaySubject<{ delta: string }>>
    >;
    ui: ReplaySubject<OutputEvent<RenderUpdate["render"]>>;
  };
  task: ReturnType<typeof runSaga>;

  constructor(
    nodesById: Map<string, WorkflowStepRef<any, any, any>>,
    outputBindings: WorkflowOutputBindings,
    options: Pick<InvokeOptions, "getStepState" | "updateStepState">
  ) {
    this.#id = uniqueId();
    this.#nodesById = nodesById;
    this.#outputBindings = outputBindings;
    this.#channel = stdChannel();
    this.#streams = {
      markdown: new ReplaySubject(),
      markdownStream: new ReplaySubject(),
      ui: new ReplaySubject(),
    };
    this.task = this.#createTask(options);
  }

  get id() {
    return this.#id;
  }

  #createTask(
    options: Pick<InvokeOptions, "getStepState" | "updateStepState">
  ) {
    const self = this;

    const channels: Record<string, ReturnType<typeof channel>> = {
      markdown: channel(),
      markdownStream: channel(),
      ui: channel(),
    };
    self.#streams["markdown"] = new ReplaySubject();
    self.#streams["markdownStream"] = new ReplaySubject();
    self.#streams["ui"] = new ReplaySubject();

    function* setInitialState(): any {
      const getStepState: InvokeOptions["getStepState"] =
        yield getContext("getStepState");
      const dispatch = yield getContext("dispatch");
      const session = yield getContext("session");
      if (getStepState) {
        const stateById: Record<string, StepState> = {};
        for (const nodeId of [...self.#nodesById.keys()]) {
          const state: StepState = yield call(getStepState, nodeId);
          stateById[nodeId] = state;
          if (state) {
            // dispatch ALREADY_INVOKED such that tasks waiting
            // for INVOKE event are cancelled before OUTPUT events
            // are emitted
            if (state.status != StepStatus.WAITING) {
              dispatch({
                type: EventType.SKIP_INVOKE,
                session,
                node: { id: nodeId },
                success: true,
              });
            }
          }
        }

        Object.entries(stateById).forEach(([nodeId, state]) => {
          if (state.status == StepStatus.INVOKED) {
            dispatch({
              type: EventType.SKIP_RUN,
              session,
              node: { id: nodeId },
            });
          } else if (state.status == StepStatus.COMPLETED) {
            dispatch({
              type: EventType.OUTPUT,
              session,
              node: { id: nodeId },
              output: state.output,
            });
            dispatch({
              type: EventType.RUN_COMPLETED,
              session,
              node: { id: nodeId },
              success: true,
            });
          }
        });
      }
    }

    function* outputSubscribers() {
      const subscriptions = Object.entries(self.#outputBindings!).map(
        ([key, outputs]) => {
          const listener = channels[key];
          return (function* saga() {
            yield fork(function* saga() {
              while (1) {
                const value = yield take(listener);
                // @ts-expect-error
                self.#streams[key].next(value);
              }
            });

            yield all(outputs.map((o) => (o as any).saga({ listener })));
          })();
        }
      );
      yield all(subscriptions);
    }

    const nodesRef = [...self.#nodesById.values()];
    function* allNodesRunCompletion(): any {
      const nodesCompleted = new Set();
      while (1) {
        const action = yield take((e: any) => {
          return (
            e.type == EventType.NO_BINDINGS ||
            e.type == EventType.SKIP_RUN ||
            e.type == EventType.RUN_COMPLETED
          );
        });
        nodesCompleted.add(action.node.id);
        if (nodesCompleted.size == nodesRef.length) {
          self.#channel.put(END);
          Object.entries(channels).forEach(([key, channel]) => {
            // @ts-expect-error
            self.#streams[key].complete();
            channel.put(END);
          });
        }
      }
    }
    function* root() {
      yield fork(setInitialState);
      yield fork(allNodesRunCompletion);
      yield fork(outputSubscribers);
      yield all(
        nodesRef.map((ref) => {
          return ref.saga.bind(ref)();
        })
      );
    }

    const task = runSaga(
      {
        channel: self.#channel,
        context: {
          session: {
            id: uniqueId(),
          },
          getStepState: options.getStepState,
          updateStepState: options.updateStepState,
          dispatch(output: any) {
            self.#channel.put(output);
          },
        },
        dispatch(output) {
          self.#channel.put(output);
        },
        // TODO: store inputs and outputs in state and use it
        // instead of using events so that workflow can be resumed
        // from any step
      },
      root
    );
    return task;
  }

  invoke(options: InvokeOptions) {
    const self = this;

    self.#channel.put({
      type: EventType.INVOKE,
      node: {
        id: options.nodeId,
      },
      input: options.input,
      dispatch(event: any) {
        self.#channel.put(event);
      },
    });

    // start workflow execution
    self.#channel.put({
      type: EventType.START,
      node: {},
    });
  }

  dispatch(event: {
    type: EventType;
    session: { id: string };
    node: { id: string };
    output: any;
  }) {
    const self = this;
    self.#channel.put({
      ...event,
      dispatch(event: any) {
        self.#channel.put(event);
      },
    });
  }

  get output() {
    const self = this;
    return {
      markdown: self.#streams.markdown,
      markdownStream: self.#streams.markdownStream,
      ui: self.#streams.ui,
    };
  }
}

export { WorkflowRun, StepStatus };
export type { InvokeOptions };
