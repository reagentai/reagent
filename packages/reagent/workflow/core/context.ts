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
  sendOutput(output: Partial<Output>): void;
  done: () => void;
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
