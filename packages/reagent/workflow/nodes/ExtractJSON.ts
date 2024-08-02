import { z, createReagentNode } from "../index.js";
import { BaseModelProvider } from "../../llm/models/index.js";

const inputSchema = z.object({
  text: z.string().label("Text"),
  model: z.instanceof(BaseModelProvider).label("Model"),
});

const outputSchema = z.object({
  json: z.any().optional().label("JSON"),
});

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
</svg>`;

const ExtractJSON = createReagentNode({
  id: "@core/extract-json",
  name: "Extract JSON",
  description: "Extract JSON from a text using LLM",
  version: "0.0.1",
  icon: ICON,
  input: inputSchema,
  output: outputSchema,
  config: z.object({
    schema: z
      .string()
      .ui({
        type: "textarea",
      })
      .default("{}"),
  }),
  async *execute(context, input) {
    throw new Error("not implemented");
  },
});

export default ExtractJSON;
