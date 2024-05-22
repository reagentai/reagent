export type Context<
  Config extends Record<string, unknown>,
  Output extends Record<string, unknown>,
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
  render<Data>(
    Component: (props: { data: Data }) => JSX.Element,
    // additional props that's passed directly to component
    // props is evaludated on the server and only value is sent
    // to the client
    data?: Data
  ): {
    update(data: Data): void;
  };
};

export type RenderContext<State = void> = {};
