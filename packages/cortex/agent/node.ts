import z from "zod";

import { Context, RenderContext } from "./context";
import { AsyncGeneratorWithField, AtLeastOne, ZodObjectSchema } from "./types";

export type Metadata<
  Config extends ZodObjectSchema,
  Input extends ZodObjectSchema,
  Output extends ZodObjectSchema,
  State extends ZodObjectSchema,
> = {
  id: string;
  name: string;
  version: string;
  icon?: string;
  type?: "tool";
  config: Config;
  input: Input;
  output: Output;
  state?: State;
};

const emptyAgentState = z.object({});
type EmptyAgentState = typeof emptyAgentState;

type RunResult<T> = AsyncGeneratorWithField<T, T | void>;

export const IS_AGENT_NODE = Symbol("_AGENT_NODE_");

export abstract class AbstractAgentNode<
  Config extends ZodObjectSchema,
  Input extends ZodObjectSchema,
  Output extends ZodObjectSchema,
  State extends ZodObjectSchema = typeof emptyAgentState,
> {
  static [IS_AGENT_NODE]: boolean = true;

  abstract get metadata(): Metadata<Config, Input, Output, State>;

  // Sub classes can override this if needed
  // For example, if a node needs to emits output without any input,
  // it can be done during init
  init(context: Context<z.infer<Config>, z.infer<Output>>) {}

  // Returns the state of the agent node
  // This is called right before the dependency of this state is called
  getState(context: Context<z.infer<Config>, z.infer<Output>>) {
    return {};
  }

  // If a node needs to run on partial output, the node should implement this
  onInputEvent(
    context: Context<z.infer<Config>, z.infer<Output>>,
    data: AtLeastOne<z.infer<Input>>
  ) {}

  abstract run(
    context: Context<z.infer<Config>, z.infer<Output>>,
    input: z.infer<Input>
  ): RunResult<AtLeastOne<z.infer<Output>>>;

  async *render(context: RenderContext): any {}

  // TODO: this method can be used to build agent workflow graph in code
  // if low-code UI is not preferred.
  //
  // potential idea:
  // const node1 = chatCompletion(config);
  // const node2 = user(config);
  // const graph = creatGraph({
  //   edges: [
  //     node1.graph.output.markdown: node2.graph.input.markdown
  //   ]
  // });
  // executeGraph(graph);
  graph() {}

  // TODO: in the future, to resolve only the output fields used by dependent nodes,
  // the interface can be updated such that AgentNode must implement `async resolve{OutputKey}`
  // That allows the dependencies to be pull based verses push-based and much more efficient
  // since the output field that isn't used doens't need to be resolved
}

type AgentNode<
  Config extends ZodObjectSchema,
  Input extends ZodObjectSchema,
  Output extends ZodObjectSchema,
  State extends ZodObjectSchema = typeof emptyAgentState,
> = AbstractAgentNode<Config, Input, Output, State> & {
  new (): AbstractAgentNode<Config, Input, Output, State>;
  run(
    context: Context<z.infer<Config>, z.infer<Output>>,
    input: z.infer<Input>
  ): RunResult<AtLeastOne<z.infer<Output>>>;
};

export { emptyAgentState };
export type { AgentNode, EmptyAgentState };
