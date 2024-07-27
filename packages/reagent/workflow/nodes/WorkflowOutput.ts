import { Observable } from "rxjs";
import { z, Context, createReagentNode } from "../index.js";

const inputSchema = z.object({
  markdownStream: z.instanceof(Observable).optional().label("Markdown stream"),
  markdown: z.string().optional().label("Markdown"),
  ui: z.instanceof(Observable).optional().label("UI"),
  data: z.instanceof(Observable).optional().label("Data"),
});

const outputSchema = z.object({
  markdownStream: z
    .instanceof(Observable)
    .optional()
    .ui({
      disabled: true,
    })
    .label("Markdown stream"),
  markdown: z
    .string()
    .optional()
    .ui({
      disabled: true,
    })
    .label("Markdown"),
  ui: z
    .instanceof(Observable)
    .optional()
    .ui({
      disabled: true,
    })
    .label("UI"),
  data: z
    .instanceof(Observable)
    .optional()
    .ui({
      disabled: true,
    })
    .label("Data"),
});

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
  <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
</svg>
`;

const WorkflowOutput = createReagentNode({
  id: "@core/output",
  name: "Workflow Output",
  description: "Exit node of a workflow",
  version: "0.0.1",
  icon: ICON,
  input: inputSchema,
  output: outputSchema,
  onInputEvent(context, data) {
    context.sendOutput(data);
  },
  async *execute(
    _context: Context<void, z.infer<typeof outputSchema>>,
    input: z.infer<typeof inputSchema>
  ) {
    yield input;
  },
});

export default WorkflowOutput;
