import { z, Context, createReagentNode } from "../index.js";

const configSchema = z.object({});

const inputSchema = z.object({});

const outputSchema = z.object({
  value: z.any().label("Value"),
});

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375m16.5 0v3.75m-16.5-3.75v3.75m16.5 0v3.75C20.25 16.153 16.556 18 12 18s-8.25-1.847-8.25-4.125v-3.75m16.5 0c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125" />
</svg>`;

const InputValue = createReagentNode({
  id: "@core/value",
  name: "Value",
  description: "Pass the given value to a workflow node",
  version: "0.0.1",
  icon: ICON,
  input: inputSchema,
  output: outputSchema,
  config: configSchema,
  async *execute(
    context: Context<
      z.infer<typeof configSchema>,
      z.infer<typeof outputSchema>
    >,
    input: z.infer<typeof inputSchema>
  ) {},
});

export default InputValue;
