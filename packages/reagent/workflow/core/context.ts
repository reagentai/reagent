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
      React: {
        useEffect: any;
        useContext: any;
      };
      AppContext?: any;
      useAgentNode<State = any>(): {
        state: State | undefined;
        setState(state: ((prev: State | undefined) => State) | State): void;
      };
    }) => JSX.Element,
    // additional props that's passed directly to component
    // props is evaludated on the server and only value is sent
    // to the client
    options?: {
      key?: string;
      data?: Data;
    }
  ): {
    update(data: Data): void;
  };
  prompt<Data, Value = any>(
    Component: (props: {
      data: Data;
      submit: (value: Value) => void;
    }) => JSX.Element,
    options?: {
      key?: string;
      data?: Data;
    }
  ): void;
  step<O = void>(
    stepId: string,
    fn: () => O | Promise<O>
  ): Promise<{
    result: O;
    // set to true if the step was already run and cached result is returned
    cached?: boolean;
  }>;

  // this can be used to execute child async generator called "task" such that
  // those children tasks can also pause workflows if needed. For example, when
  // using context.prompt(...)
  task<Fn extends (...args: any[]) => any>(
    fn: Fn,
    ...args: Parameters<Fn>
  ): Symbol;

  // return 'PENDING' from 'execute' method if output will be sent later
  // using sendOutput. `context.done()` should be called when step is completed
  // if 'PENDING' is returned
  PENDING: Symbol;
  TASK: Symbol;
};

export type RenderContext<State = void> = {};
