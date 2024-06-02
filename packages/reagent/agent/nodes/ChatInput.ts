import { z, Context, createAgentNode } from "../";
import { BaseModelProvider } from "../../llm/models";

const inputSchema = z.object({});

const outputSchema = z.object({
  query: z.string().label("Query"),
  model: z.instanceof(BaseModelProvider).label("Model"),
});

const ChatInputNode = createAgentNode({
  id: "@core/input",
  name: "Chat Input",
  version: "0.0.1",
  input: inputSchema,
  output: outputSchema,
  async *execute(
    _context: Context<void, z.infer<typeof outputSchema>>,
    input: z.infer<typeof outputSchema>
  ) {
    // TODO: add input validation node
    yield input;
  },
});

export default ChatInputNode;
