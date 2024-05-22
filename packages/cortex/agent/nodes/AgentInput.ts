import { z, Context, createAgentNode } from "../";

const configSchema = z.object({});

const inputSchema = z.object({});

const outputSchema = z
  .object({
    query: z.string().label("Query"),
  })
  .passthrough();

export default createAgentNode({
  id: "@core/input",
  name: "Agent Input",
  version: "0.0.1",
  input: inputSchema,
  output: outputSchema,
  async *run(
    context: Context<
      z.infer<typeof configSchema>,
      z.infer<typeof outputSchema>
    >,
    input: z.infer<typeof inputSchema>
  ) {
    // TODO: add input validation node
    yield input;
  },
});
