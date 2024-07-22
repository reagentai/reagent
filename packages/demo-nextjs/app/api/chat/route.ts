import { z } from "@reagentai/reagent";
import { OpenAI } from "@reagentai/reagent/llm/models";
import { runReagentWorkflow } from "@reagentai/serve";
import agent from "@reagentai/react-examples/e2b";

const invokeSchema = z.object({
  input: z.object({
    id: z.string(),
    message: z.object({
      content: z.string(),
    }),
    model: z
      .object({
        provider: z.enum(["openai", "anthropic", "groq"]),
        name: z.string(),
      })
      .optional(),
  }),
});

export async function POST(request: Request) {
  const { input } = invokeSchema.parse(await request.json());
  const model = new OpenAI({
    model: "gpt-3.5-turbo",
  });

  const workflowOutput = runReagentWorkflow<any>(agent, {
    nodeId: "input",
    input: {
      query: input.message.content,
      model,
    },
  });
  return workflowOutput.toResponse();
}
