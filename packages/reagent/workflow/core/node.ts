import { z, ZodObjectSchema } from "./zod.js";
import { Context, RenderContext } from "./context.js";
import type { AsyncGeneratorWithField, AtLeastOne } from "./types.js";

type WithDefaultEmpty<T> =
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
  type?: "tool";
  config: ZodObjectSchema<Config>;
  input: ZodObjectSchema<Input>;
  output: ZodObjectSchema<Output>;
  // whether this node renders UI components
  // this doesn't have to be passed when creating a node since
  // babel plugin will set this during build time
  hasUI?: boolean;
};

type ExecutionResult<T> = AsyncGeneratorWithField<T>;

export const IS_AGENT_NODE = Symbol("_AGENT_NODE_");

export abstract class AbstractWorkflowNode<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
> {
  // "phantom" field to infer output type
  _types: { output: Output };
  constructor() {
    this._types = undefined as any;
  }

  static [IS_AGENT_NODE]: boolean = true;

  abstract get metadata(): Metadata<WithDefaultEmpty<Config>, Input, Output>;

  // If a node needs to run on partial output, the node should implement this
  onInputEvent(context: Context<Config, Output>, data: AtLeastOne<Input>) {}

  abstract execute(
    context: Context<Config, Output>,
    input: Input
  ): ExecutionResult<AtLeastOne<Output>>;

  async *render(context: RenderContext): any {}

  // TODO: in the future, to resolve only the output fields used by dependent nodes,
  // the interface can be updated such that WorkflowNode must implement `async resolve{OutputKey}`
  // That allows the dependencies to be pull based verses push-based and much more efficient
  // since the output field that isn't used doens't need to be resolved
}

type WorkflowNode<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
> = AbstractWorkflowNode<Config, Input, Output> & {
  new (): AbstractWorkflowNode<Config, Input, Output>;
  execute(
    context: Context<Config, Output>,
    input: Input
  ): ExecutionResult<AtLeastOne<Output>>;
};

export const createReagentNode = <
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
  hasUI?: boolean;
  onInputEvent?: (
    context: Context<Config, Output>,
    data: AtLeastOne<Input>
  ) => void;
  execute: WorkflowNode<Config, WithDefaultEmpty<Input>, Output>["execute"];
}) => {
  const config = (options.config || z.object({})) as ZodObjectSchema<
    WithDefaultEmpty<Config>
  >;
  const inputSchema = (options.input || z.object({})) as ZodObjectSchema<
    WithDefaultEmpty<Input>
  >;
  // @ts-expect-error
  const clazz = class WorkflowNode extends AbstractWorkflowNode<
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
        icon: options.icon,
        config,
        input: inputSchema,
        output: options.output,
        hasUI: options.hasUI,
      };
    }
  };
  clazz.prototype.execute = options.execute;
  if (options.onInputEvent) {
    clazz.prototype.onInputEvent = options.onInputEvent;
  }
  return clazz as unknown as WorkflowNode<
    Config,
    WithDefaultEmpty<Input>,
    Output
  >;
};

export type { WorkflowNode };
