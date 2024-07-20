import { ReplaySubject } from "rxjs";
import { runSaga, stdChannel } from "redux-saga";
import { all, fork } from "redux-saga/effects";

import { WorkflowStepRef } from "./WorkflowStep.js";
import { NodeMetadata, WorkflowOutputBindings, RenderUpdate } from "./types.js";
import { uniqueId } from "../../utils/uniqueId.js";

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
  }

  get id() {
    return this.#id;
  }

  start() {
    const self = this;
    const sagas = [...this.#nodesById.values()].map((ref) => {
      return ref.saga();
    });
    function* root() {
      yield fork(self.saga.bind(self));
      yield all(sagas);
    }

    const state = {
      inputsByNodeId: {},
      outputsByNodeId: {},
    };
    const task = runSaga(
      {
        channel: self.#channel,
        dispatch(output) {
          self.#channel.put(output);
        },
        context: {
          session: {
            id: uniqueId(),
          },
          dispatch(output: any) {
            self.#channel.put(output);
          },
        },
        getState: () => {
          return state;
        },
        // TODO: store inputs and outputs in state and use it
        // instead of using events so that workflow can be resumed
        // from any step
        // effectMiddlewares: [
        //   function middleware(next) {
        //     return (effect) => {
        //       if (effect.type == "CALL") {
        //         const action = effect.payload.args[0];
        //         if (action.type == "INPUT") {
        //           dsetMerge(state.inputsByNodeId, action.node.id, action.input);
        //         }
        //       }
        //       next(effect);
        //     };
        //   },
        // ],
      },
      root
    );
  }

  invoke(options: { nodeId: string; input: any }) {
    const self = this;
    self.#channel.put({
      type: "INVOKE",
      node: {
        id: options.nodeId,
      },
      input: options.input,
      dispatch(event: any) {
        self.#channel.put(event);
      },
    });
  }

  *saga() {
    const self = this;
    const streams = self.#streams;
    const sagas = Object.fromEntries(
      Object.entries(self.#outputBindings!).flatMap(([key, outputs]) => {
        return outputs.map((o: any) => [
          key,
          (function* saga(): any {
            while (1) {
              // TODO: since new generator is initialized in a while loop
              // test whether outputs/renders will be dropped under load
              const res = yield o.saga();
              streams[key as keyof typeof streams].next(res);
            }
          })(),
        ]);
      })
    );
    yield all(sagas);
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
