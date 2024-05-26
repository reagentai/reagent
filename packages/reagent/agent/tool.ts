import { GraphNode } from "./GraphNode";
import { ZodObjectSchema } from "./types";
import { z } from "./zod";

const agentToolSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(4),
  description: z.string().min(10),
  // zod schema
  parameters: z.record(z.string(), z.unknown()),
  node: z.custom<GraphNode<any, any, any>>(),
});

type AgentTool = {
  id: string;
  name: string;
  description: string;
  parameters: ZodObjectSchema;
  node: GraphNode<any, any, any>;
};

export { agentToolSchema };
export type { AgentTool };
