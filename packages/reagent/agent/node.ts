import { z } from "./zod.js";
import { Context, RenderContext } from "./context.js";
import type {
  AsyncGeneratorWithField,
  AtLeastOne,
  ZodObjectSchema,
} from "./types";

type WithDefaultEmpty<T> =
  T extends Record<string, unknown> ? T : Record<string, unknown>;

export type Metadata<
  Config extends Record<string, unknown>,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
  State = Record<string, unknown>,
> = {
  id: string;
  name: string;
  description?: string;
  version: string;
  icon?: string;
  type?: "tool";
  config: ZodObjectSchema<Config>;
  input: ZodObjectSchema<Input>;
  output: ZodObjectSchema<Output>;
  state?: ZodObjectSchema<State>;
};

type RunResult<T> = AsyncGeneratorWithField<T>;

export const IS_AGENT_NODE = "__REAGENT_AGENT_NODE__";

export abstract class AbstractAgentNode<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>,
> {
  // "phantom" field to infer output type
  _types: { output: Output };
  constructor() {
    this._types = undefined as any;
  }

  static [IS_AGENT_NODE]: boolean = true;

  abstract get metadata(): Metadata<
    WithDefaultEmpty<Config>,
    Input,
    Output,
    State
  >;

  // Sub classes can override this if needed
  // For example, if a node needs to emits output without any input,
  // it can be done during init
  // Note: init `context.run` could be different than node runs
  init(context: Context<Config, Output>) {}

  // Returns the state of the agent node
  // This is called right before the dependency of this state is called
  getState(context: Context<Config, Output>) {
    return {};
  }

  // If a node needs to run on partial output, the node should implement this
  onInputEvent(context: Context<Config, Output>, data: AtLeastOne<Input>) {}

  abstract execute(
    context: Context<Config, Output>,
    input: Input
  ): RunResult<AtLeastOne<Output>>;

  async *render(context: RenderContext): any {}

  // TODO: in the future, to resolve only the output fields used by dependent nodes,
  // the interface can be updated such that AgentNode must implement `async resolve{OutputKey}`
  // That allows the dependencies to be pull based verses push-based and much more efficient
  // since the output field that isn't used doens't need to be resolved
}

type AgentNode<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
  State extends Record<string, unknown> = Record<string, unknown>,
> = AbstractAgentNode<Config, Input, Output, State> & {
  new (): AbstractAgentNode<Config, Input, Output, State>;
  run(
    context: Context<Config, Output>,
    input: Input
  ): RunResult<AtLeastOne<Output>>;
};

export const createAgentNode = <
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown> | void,
  Output extends Record<string, unknown>,
>(options: {
  id: string;
  version: string;
  name: string;
  description?: string;
  type?: "tool";
  icon?: string;
  config?: ZodObjectSchema<Config>;
  input?: ZodObjectSchema<Input>;
  output: ZodObjectSchema<Output>;
  execute: AgentNode<Config, WithDefaultEmpty<Input>, Output>["run"];
}) => {
  const config = (options.config || z.object({})) as ZodObjectSchema<
    WithDefaultEmpty<Config>
  >;
  const inputSchema = (options.input || z.object({})) as ZodObjectSchema<
    WithDefaultEmpty<Input>
  >;
  // @ts-expect-error
  const clazz = class AgentTool extends AbstractAgentNode<
    Config,
    WithDefaultEmpty<Input>,
    Output
  > {
    get metadata() {
      return {
        id: options.id,
        version: options.version,
        name: options.name,
        description: options.description,
        type: options.type,
        config,
        input: inputSchema,
        output: options.output,
      };
    }
  };
  clazz.prototype.execute = options.execute;
  return clazz as unknown as AgentNode<Config, WithDefaultEmpty<Input>, Output>;
};

export type { AgentNode };
