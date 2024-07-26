import { z, Context, createReagentNode } from "../index.js";
import { BaseModelProvider } from "../../llm/models/index.js";

const inputSchema = z.object({});

const outputSchema = z.object({
  query: z.string().label("Query"),
  model: z.instanceof(BaseModelProvider).label("Model"),
});

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M8.25 9V5.25A2.25 2.25 0 0 1 10.5 3h6a2.25 2.25 0 0 1 2.25 2.25v13.5A2.25 2.25 0 0 1 16.5 21h-6a2.25 2.25 0 0 1-2.25-2.25V15M12 9l3 3m0 0-3 3m3-3H2.25" />
</svg>
`;

const WorkflowInput = createReagentNode({
  id: "@core/input",
  name: "Workflow Input",
  description: "Entry node of a workflow",
  version: "0.0.1",
  icon: ICON,
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

export default WorkflowInput;
