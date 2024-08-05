import { z, ZodObjectSchema } from "./zod.js";
import { Context, RenderContext } from "./context.js";
import type {
  AtLeastOne,
  BaseReagentNodeOptions,
  ExecutionResult,
  Metadata,
  WithDefaultEmpty,
} from "./types.js";

const IS_AGENT_NODE = Symbol("_AGENT_NODE_");

abstract class AbstractWorkflowNode<
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
  components: [string, () => any][];
  execute(
    context: Context<Config, Output>,
    input: Input
  ): ExecutionResult<AtLeastOne<Output>>;
};

const createReagentNode = <
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown> | void,
  Output extends Record<string, unknown>,
>(
  options: BaseReagentNodeOptions<Config, Input, Output> & {
    description?: string;
    type?: "tool";
    icon?: string;
    target?: "client";
    config?: ZodObjectSchema<Config>;
    input?: ZodObjectSchema<Input>;
    output: ZodObjectSchema<Output>;
    hasUI?: boolean;
    onInputEvent?: (
      context: Context<Config, Output>,
      data: AtLeastOne<Input>
    ) => void;
  }
) => {
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
        target: options.target,
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

export type { WorkflowNode, BaseReagentNodeOptions };
export { IS_AGENT_NODE, AbstractWorkflowNode, createReagentNode };
