import { Hono } from "hono";
import { handle } from "hono/vercel";
import agent from "@reagentai/react-examples/weather";
import { z } from "@reagentai/reagent/agent";
import { invokeGraphAgent } from "@reagentai/serve";
import { OpenAI } from "@reagentai/reagent/llm/integrations/models";

const app = new Hono();

const invokeSchema = z.object({
  id: z.string(),
  message: z.object({
    content: z.string(),
  }),
});

app.post("/api/chat/invoke", async (ctx) => {
  const body = invokeSchema.parse(await ctx.req.json());
  const model = new OpenAI({
    model: "gpt-3.5-turbo",
  });

  const agentOutputStream = invokeGraphAgent<any>(agent, {
    nodeId: "input",
    input: {
      query: body.message.content,
      model,
    },
  });
  return agentOutputStream.toResponse();
});

export const GET = handle(app);
export const POST = handle(app);
