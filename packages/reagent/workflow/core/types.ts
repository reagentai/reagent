import type { Context } from "./context.js";
import type { ZodObjectSchema } from "./zod.js";

export type AtLeastOne<T> = {
  [K in keyof T]-?: Pick<T, K> & Partial<Omit<T, K>>;
}[keyof T];

export type AsyncGeneratorWithField<T> = AsyncGenerator<
  T | void,
  Symbol | void,
  void | never
>;

export type WithDefaultEmpty<T> =
  T extends Record<string, unknown> ? T : Record<string, unknown>;

export type Metadata<
  Config extends Record<string, unknown>,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
> = {
  id: string;
  name: string;
  description?: string;
  version: string;
  icon?: string;
  target?: "client";
  type?: "tool";
  config: ZodObjectSchema<Config>;
  input: ZodObjectSchema<Input>;
  output: ZodObjectSchema<Output>;
  // whether this node renders UI components
  // this doesn't have to be passed when creating a node since
  // babel plugin will set this during build time
  hasUI?: boolean;
};

export type ExecutionResult<T> = AsyncGeneratorWithField<T>;

export type BaseReagentNodeOptions<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown> | void,
  Output extends Record<string, unknown>,
> = {
  id: string;
  version: string;
  name: string;
  target?: "client";
  execute(
    context: Context<Config, Output>,
    input: WithDefaultEmpty<Input>
  ): ExecutionResult<AtLeastOne<Output> | Symbol>;
};
