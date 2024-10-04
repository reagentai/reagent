import { ReplaySubject } from "rxjs";
import deepmerge from "deepmerge";
import { channel, runSaga, stdChannel } from "redux-saga";
import {
  actionChannel,
  all,
  call,
  cancel,
  fork,
  getContext,
  join,
  put,
  take,
} from "redux-saga/effects";
import { deserializeError } from "serialize-error";

import {
  NodeMetadata,
  RenderUpdate,
  Session,
  WorkflowRunOptions,
  StepStatus,
  StepState,
  EventType,
  WorkflowStatus,
} from "./types.js";
import { uniqueId } from "../../utils/uniqueId.js";
import { ValueProvider } from "./WorkflowStepOutput.js";
import { InternalWorkflowRef } from "./Workflow.js";

type OutputEvent<Output> = {
  // session is null for session independent global values
  session: Session | null;
  node: NodeMetadata;
  value: Output;
};

class WorkflowRun {
  #ref: InternalWorkflowRef;
  #id: string;
  #session: Session;
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
  #status: WorkflowStatus;

  constructor(
    ref: InternalWorkflowRef,
    options: Omit<WorkflowRunOptions, "events">
  ) {
    this.#ref = ref;
    this.#id = uniqueId();
    this.#session = {
      id: options.sessionId || uniqueId(),
    };
    this.#channel = stdChannel();
    this.#streams = {
      markdown: new ReplaySubject(),
      markdownStream: new ReplaySubject(),
      ui: new ReplaySubject(),
      events: new ReplaySubject(),
    };
    this.#status = WorkflowStatus.NOT_STARTED;
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

  get status() {
    return this.#status;
  }

  get task() {
    if (!this.#task) {
      throw new Error("Workflow run not started");
    }
    return this.#task!;
  }

  #initTask(
    options: Pick<WorkflowRunOptions, "getStepState" | "updateStepState">
  ) {
    const self = this;
    let stepStates: Record<string, any> = {};
    return runSaga(
      {
        channel: self.#channel,
        context: {
          session: self.#session,
          async getStepState(nodeId: string) {
            if (options.getStepState) {
              return await options.getStepState(nodeId);
            }
          },
          async updateStepState(node: NodeMetadata, state: StepState) {
            if (options.updateStepState) {
              if (!stepStates[node.id]) {
                stepStates[node.id] = options.getStepState
                  ? await options.getStepState(node.id)
                  : {};
              }
              stepStates[node.id] = deepmerge(
                stepStates[node.id] || {},
                state as any
              );
              options.updateStepState(node, stepStates[node.id]);
            }
          },
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
      self.#saga()
    );
  }

  #saga() {
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
      const subscriptions = Object.entries(self.#ref.outputBindings!)
        .filter(([key]) => key != "data")
        .map(([key, outputs]) => {
          const listener = channels[key];
          return (function* saga() {
            yield fork(function* saga() {
              while (1) {
                const value: any = yield take(listener);
                // don't emit old output values that are re-emitted
                // when the workflow is resumed
                if (!value.isReplay) {
                  // @ts-expect-error
                  self.#streams[key].next(value);
                }
              }
            });
            yield all(
              (outputs as unknown as [string, ValueProvider<any>[]]).map((o) =>
                (o as any).saga({ listener })
              )
            );
          })();
        });
      yield all(subscriptions);
    }

    function* eventsSubscriber(): any {
      const channel = yield actionChannel(
        (e: any) =>
          e.type == EventType.EXECUTE_ON_CLIENT ||
          e.type == EventType.PROMPT ||
          e.type == EventType.SUB_RENDER
      );
      while (1) {
        const event = yield take(channel);
        if (event.type == EventType.SUB_RENDER) {
          const { type, ...rest } = event;
          self.#streams["ui"].next(rest);
        } else {
          self.#streams["events"].next(event);
        }
      }
    }

    // this will first dispatch events based on the node state
    // and then emit queued events
    function* startWorkflow(incomingEvents: any): any {
      const session = self.#session;
      const getStepState = yield getContext("getStepState");
      if (getStepState) {
        const stateById: Record<string, StepState> = {};
        for (const nodeId of [...self.#ref.nodesById.keys()]) {
          const state: StepState = yield call(getStepState, nodeId);
          if (state) {
            stateById[nodeId] = state;
            const { "@@status": status, "@@data": data } = state;
            // dispatch SKIP_INVOKE such that tasks waiting
            // for INVOKE event are cancelled before OUTPUT events
            // are emitted
            if (
              status == StepStatus.COMPLETED ||
              status == StepStatus.FAILED ||
              status == StepStatus.INVOKED
            ) {
              self.#channel.put({
                type: EventType.SKIP_INVOKE,
                session,
                node: { id: nodeId },
                success: true,
              });
            } else if (status == StepStatus.STOPPED) {
              self.#channel.put({
                type: EventType.INVOKE,
                session,
                node: { id: nodeId },
                input: data.input,
              });
            }
          }
        }

        Object.entries(stateById).forEach(([nodeId, state]) => {
          const { "@@status": status, "@@data": data } = state;
          if (status == StepStatus.COMPLETED) {
            self.#channel.put({
              type: EventType.OUTPUT,
              session,
              node: { id: nodeId },
              output: data.output,
              isReplay: true,
            });
            self.#channel.put({
              type: EventType.RUN_COMPLETED,
              session,
              node: { id: nodeId },
            });
          } else if (
            status == StepStatus.INVOKED ||
            status == StepStatus.FAILED ||
            status == StepStatus.STOPPED
          ) {
          } else {
            throw new Error("not implemented");
          }
        });
      }

      while (true) {
        const { data } = yield take(incomingEvents);
        yield put(data);
      }
    }

    function* updateState(): any {
      const channel = yield actionChannel((e: any) => {
        return e.type == EventType.UPDATE_STATE;
      });
      const updateStepState = yield getContext("updateStepState");
      while (1) {
        const action = yield take(channel);
        yield call(updateStepState, action.node, action.state);
      }
    }

    const nodesRef = [...self.#ref.nodesById.values()];
    function* allNodesRunCompletion(): any {
      const channel = yield actionChannel((e: any) => {
        return (
          e.type == EventType.NO_BINDINGS ||
          e.type == EventType.SKIP_RUN ||
          e.type == EventType.EXECUTE_ON_CLIENT ||
          e.type == EventType.RUN_COMPLETED ||
          e.type == EventType.RUN_PAUSED ||
          e.type == EventType.RUN_CANCELLED ||
          e.type == EventType.RUN_FAILED
        );
      });
      let result: { status: WorkflowStatus; error?: any } = {
        status: WorkflowStatus.COMPLETED,
      };
      const nodesCompleted = new Set();
      while (1) {
        const action = yield take(channel);
        // if node.path is set, the action is of sub-workflow,
        // so skip it
        if (action.node.path && action.node.path.length > 0) {
          continue;
        }
        if (
          action.type == EventType.RUN_PAUSED ||
          action.type == EventType.EXECUTE_ON_CLIENT
        ) {
          result = { status: WorkflowStatus.STOPPED };
        } else if (action.type == EventType.RUN_FAILED) {
          result = { status: WorkflowStatus.ERRORED, error: action.error };
        }

        nodesCompleted.add(action.node.id);
        if (nodesCompleted.size == nodesRef.length) {
          self.#channel.close();
          Object.entries(channels).forEach(([key, channel]) => {
            // @ts-expect-error
            self.#streams[key].complete();
            channel.close();
          });
          return result;
        }
      }
    }
    return function* root(): any {
      self.#status = WorkflowStatus.IN_PROGRESS;
      const incomingEvents = yield actionChannel("INCOMING_EVENT");
      const _queueEvents = yield fork(startWorkflow, incomingEvents);
      const completionSaga = yield fork(allNodesRunCompletion);
      const _job3 = yield fork(eventsSubscriber);
      const _job4 = yield fork(outputSubscribers);
      const _job6 = yield fork(updateState);

      const dataBinding = self.#ref.outputBindings?.["data"];
      const outputSaga = dataBinding
        ? yield fork((dataBinding as any).saga.bind(dataBinding))
        : undefined;

      yield all(
        nodesRef.map((ref) => {
          return ref.saga.bind(ref)();
        })
      );

      // yield join([queueEvents, job3, job4, job6]);

      const result = yield join(completionSaga);
      const output = dataBinding ? yield join(outputSaga) : undefined;

      self.#status = result;
      if (result.status == WorkflowStatus.STOPPED) {
        // cancel here so that task.isCancelled() returns true
        // if the workflow wasn't completed
        yield cancel();
      } else if (result.status == WorkflowStatus.ERRORED) {
        throw deserializeError(result.error);
      }
      return output?.value;
    };
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
