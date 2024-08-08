import { NodeMetadata, StepState } from "../client.js";

export type Context<
  Config extends Record<string, unknown> | void,
  Output extends Record<string, unknown>,
> = {
  node: {
    id: string;
  };
  session: {
    id: string;
  };
  config: Config;
  // only set if the node is in progress
  // node will be in progress if `context.setProgress(...)` is called
  state: StepState | undefined;
  updateState(node: NodeMetadata, state: StepState): void;
  emit(event: any): void;
  sendOutput(output: Partial<Output>): void;
  // stop the current node execution. This node will be resumed when
  // the workflow is triggered again after getting the data from client
  // execution of a sub-workflow step or other triggers (webhooks?)
  stop(): void;
  // if `context.PENDING` is returned from `execute(...)`, done() should
  // be called to stop the node execution
  done(): void;
  render<Data>(
    Component: (props: {
      data: Data;
      useAgentNode<State = any>(): {
        state: State | undefined;
        setState(state: ((prev: State | undefined) => State) | State): void;
      };
    }) => JSX.Element,
    // additional props that's passed directly to component
    // props is evaludated on the server and only value is sent
    // to the client
    data?: Data
  ): {
    update(data: Data): void;
  };
  // return 'PENDING' from 'execute' method if output will be sent later
  // using sendOutput. `context.done()` should be called when step is completed
  // if 'PENDING' is returned
  PENDING: Symbol;
};

export type RenderContext<State = void> = {};
