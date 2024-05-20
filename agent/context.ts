export type Context<
  Config extends Record<string, unknown>,
  Output extends Record<string, unknown>
> = {
  config: Config;
  requiredOutputFields: (keyof Output)[];
  sendOutput(output: Output): void;
};

export type RenderContext<State = void> = {};
