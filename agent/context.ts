export type Context<
  Config extends Record<string, unknown>,
  Output extends Record<string, unknown>
> = {
  node: {
    id: string;
  };
  run: {
    id: string;
  };
  config: Config;
  requiredOutputFields: (keyof Output)[];
  sendOutput(output: Output): void;
  render<State>(
    Component: (props: { state: State }) => JSX.Element,
    // additional props that's passed directly to component
    // props is evaludated on the server and only value is sent
    // to the client
    state?: State
  ): {
    update(state: State): void;
  };
};

export type RenderContext<State = void> = {};
