import z from "zod";

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

export { node, edge, graph };
export type Node = z.infer<typeof node>;
export type Edge = z.infer<typeof edge>;
export type Graph = z.infer<typeof graph>;
