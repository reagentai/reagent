import { merge, ReplaySubject } from "rxjs";
import { runSaga, stdChannel } from "redux-saga";
import { all, fork } from "redux-saga/effects";

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
    outputBindings: WorkflowOutputBindings
  ) {
    this.#id = uniqueId();
    this.#nodesById = nodesById;
    this.#outputBindings = outputBindings;
    this.#streams = {
      markdown: new ReplaySubject(),
      markdownStream: new ReplaySubject(),
      ui: new ReplaySubject(),
    };
    this.#channel = stdChannel();
    this.task = this.#createTask();
  }

  get id() {
    return this.#id;
  }

  #createTask() {
    const self = this;

    const subscriptions = [];
    Object.entries(self.#outputBindings!).forEach(([key, outputs]) => {
      // @ts-expect-error
      self.#streams[key] = merge(
        ...outputs.map((o) => {
          // @ts-expect-error
          const [observable, unsubscribe] = o.observable();
          subscriptions.push(unsubscribe);
          return observable;
        })
      );
    });

    function* root() {
      yield all(
        [...self.#nodesById.values()].map((ref) => {
          return fork(ref.saga.bind(ref));
        })
      );
    }

    const state = {
      inputsByNodeId: {},
      outputsByNodeId: {},
    };
    const task = runSaga(
      {
        channel: self.#channel,
        getState: () => {
          return state;
        },
        context: {
          session: {
            id: uniqueId(),
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
      root
    );
    return task;
  }

  invoke(options: { nodeId: string; input: any }) {
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

export { WorkflowRun };
