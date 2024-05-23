import { z, Context, createAgentNode } from "../";

const inputSchema = z.object({});

const outputSchema = z.object({
  query: z.string().label("Query"),
});

export default createAgentNode({
  id: "@core/input",
  name: "Chat Input",
  version: "0.0.1",
  config: z.void(),
  input: inputSchema,
  output: outputSchema,
  async *run(
    _context: Context<void, z.infer<typeof outputSchema>>,
    input: z.infer<typeof outputSchema>
  ) {
    // TODO: add input validation node
    yield input;
  },
});
