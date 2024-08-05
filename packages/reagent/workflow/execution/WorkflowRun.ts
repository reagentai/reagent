import { ReplaySubject } from "rxjs";
import { channel, runSaga, stdChannel } from "redux-saga";
import { actionChannel, all, call, fork, put, take } from "redux-saga/effects";

import { WorkflowStepRef } from "./WorkflowStep.js";
import {
  NodeMetadata,
  WorkflowOutputBindings,
  RenderUpdate,
  Session,
  WorkflowRunOptions,
  StepStatus,
  StepState,
  EventType,
} from "./types.js";
import { uniqueId } from "../../utils/uniqueId.js";

type OutputEvent<Output> = {
  // session is null for session independent global values
  session: Session | null;
  node: NodeMetadata;
  value: Output;
};

class WorkflowRun {
  #id: string;
  #session: Session;
  #nodesById: Map<string, WorkflowStepRef<any, any, any>>;
  #outputBindings?: WorkflowOutputBindings;
  #channel: ReturnType<typeof stdChannel>;
  #streams: {
    markdown: ReplaySubject<OutputEvent<string>>;
    markdownStream: ReplaySubject<
      OutputEvent<ReplaySubject<{ delta: string }>>
    >;
    ui: ReplaySubject<OutputEvent<RenderUpdate["render"]>>;
    events: ReplaySubject<{
      type: EventType.EXECUTE_ON_CLIENT;
      session: Session;
      node: NodeMetadata;
      input: any;
    }>;
  };
  #task: ReturnType<typeof runSaga> | undefined;

  constructor(
    nodesById: Map<string, WorkflowStepRef<any, any, any>>,
    outputBindings: WorkflowOutputBindings,
    options: Omit<WorkflowRunOptions, "events">
  ) {
    this.#id = uniqueId();
    this.#session = {
      id: options.sessionId || uniqueId(),
    };
    this.#nodesById = nodesById;
    this.#outputBindings = outputBindings;
    this.#channel = stdChannel();
    this.#streams = {
      markdown: new ReplaySubject(),
      markdownStream: new ReplaySubject(),
      ui: new ReplaySubject(),
      events: new ReplaySubject(),
    };
    this.#task = this.#initTask(options);
  }

  get id() {
    return this.#id;
  }

  get events() {
    return this.#streams.events;
  }

  get output() {
    const self = this;
    return {
      markdown: self.#streams.markdown,
      markdownStream: self.#streams.markdownStream,
      ui: self.#streams.ui,
    };
  }

  get task() {
    if (!this.#task) {
      throw new Error("Workflow run not initialized");
    }
    return this.#task!;
  }

  #initTask(options: Omit<WorkflowRunOptions, "events">) {
    const self = this;
    self.#streams["markdown"] = new ReplaySubject();
    self.#streams["markdownStream"] = new ReplaySubject();
    self.#streams["ui"] = new ReplaySubject();

    const channels: Record<string, ReturnType<typeof channel>> = {
      markdown: channel(),
      markdownStream: channel(),
      ui: channel(),
    };

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

    function* eventsSubscriber(): any {
      while (1) {
        const event = yield take(
          (e: any) => e.type == EventType.EXECUTE_ON_CLIENT
        );
        self.#streams["events"].next(event);
      }
    }

    // this will first dispatch events based on the node state
    // and then emit queued events
    function* startWorkflow(incomingEvents: any): any {
      const session = self.#session;
      const { getStepState } = options;
      if (getStepState) {
        const stateById: Record<string, StepState> = {};
        for (const nodeId of [...self.#nodesById.keys()]) {
          const state = yield call(getStepState, nodeId);
          if (state) {
            stateById[nodeId] = state;
            // dispatch ALREADY_INVOKED such that tasks waiting
            // for INVOKE event are cancelled before OUTPUT events
            // are emitted
            if (state.status != StepStatus.WAITING) {
              self.#channel.put({
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
            self.#channel.put({
              type: EventType.SKIP_RUN,
              session,
              node: { id: nodeId },
            });
          } else if (state.status == StepStatus.COMPLETED) {
            self.#channel.put({
              type: EventType.OUTPUT,
              session,
              node: { id: nodeId },
              output: state.output,
            });
            self.#channel.put({
              type: EventType.RUN_COMPLETED,
              session,
              node: { id: nodeId },
            });
          }
        });
      }

      while (true) {
        const { data } = yield take(incomingEvents);
        yield put(data);
      }
    }

    const nodesRef = [...self.#nodesById.values()];
    function* allNodesRunCompletion(): any {
      const nodesCompleted = new Set();
      while (1) {
        const action = yield take((e: any) => {
          return (
            e.type == EventType.NO_BINDINGS ||
            e.type == EventType.SKIP_RUN ||
            e.type == EventType.RUN_COMPLETED ||
            e.type == EventType.EXECUTE_ON_CLIENT ||
            e.type == EventType.RUN_CANCELLED
          );
        });
        nodesCompleted.add(action.node.id);
        if (nodesCompleted.size == nodesRef.length) {
          self.#channel.close();
          Object.entries(channels).forEach(([key, channel]) => {
            // @ts-expect-error
            self.#streams[key].complete();
            channel.close();
          });
          break;
        }
      }
    }
    function* root(): any {
      const incomingEvents = yield actionChannel("INCOMING_EVENT");
      yield fork(startWorkflow, incomingEvents);
      yield fork(allNodesRunCompletion);
      yield fork(eventsSubscriber);
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
          session: self.#session,
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

  queueEvents(event: WorkflowRunOptions["events"][number]) {
    const self = this;
    self.#channel.put({
      type: "INCOMING_EVENT",
      data: {
        ...event,
        session: self.#session,
      },
    });
  }
}

export { WorkflowRun, StepStatus };
export type { WorkflowRunOptions };
