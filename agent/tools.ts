import { z } from "./zod";
import { ZodObjectSchema } from "./types";
import { AbstractAgentNode, AgentNode } from "./node";

const emptyZodObject = z.object({});
type WithDefaultZodObjectSchema<T> = T extends ZodObjectSchema
  ? T
  : typeof emptyZodObject;

export const createAgentNode = <
  Config extends ZodObjectSchema | undefined,
  Input extends ZodObjectSchema | undefined,
  Output extends ZodObjectSchema
>(options: {
  id: string;
  version: string;
  name: string;
  type?: "tool";
  icon?: string;
  config?: Config;
  input?: Input;
  output: Output;
  run: AgentNode<
    WithDefaultZodObjectSchema<Config>,
    WithDefaultZodObjectSchema<Input>,
    Output
  >["run"];
}) => {
  const config = options.config || z.object({});
  const inputSchema = options.input || z.object({});
  // @ts-expect-error
  const clazz = class AgentTool extends AbstractAgentNode<
    typeof config,
    typeof inputSchema,
    Output
  > {
    get metadata() {
      return {
        id: options.id,
        version: options.version,
        name: options.name,
        type: options.type,
        config,
        input: inputSchema,
        output: options.output,
      };
    }
  };
  clazz.prototype.run = options.run;
  return clazz as unknown as AgentNode<
    WithDefaultZodObjectSchema<Config>,
    WithDefaultZodObjectSchema<Input>,
    Output
  >;
};
