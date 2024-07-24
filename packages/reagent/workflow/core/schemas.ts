import { z, ZodObjectSchema } from "./zod.js";

const node = z.object({
  id: z.string(),
  type: z.string(),
  config: z.any(),
});

const edge = z.object({
  id: z.string(),
  from: z.object({
    type: z.enum(["output"]),
    node: z.string(),
    outputKey: z.string(),
  }),
  to: z.object({
    node: z.string(),
    inputKey: z.string(),
  }),
});

const graph = z.object({
  nodes: z.array(node),
  edges: z.array(edge),
});

const agentToolSchema = z.object({
  name: z.string().min(4),
  description: z.string().min(10),
  parameters: z.custom<ZodObjectSchema>(),
  execute: z.custom<(params: any) => Promise<any>>(),
});

export { node, edge, graph, agentToolSchema };
export type Node = z.infer<typeof node>;
export type Edge = z.infer<typeof edge>;
export type Graph = z.infer<typeof graph>;
