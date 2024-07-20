import { Hono } from "hono";
import { Workflow, z } from "@reagentai/reagent/workflow/index.js";
import { ChatInput as ChatInputNode } from "@reagentai/reagent/nodes.js";
import {
  AnthropicChat,
  Groq,
  OpenAI,
} from "@reagentai/reagent/llm/integrations/models/index.js";
import { DummyModel } from "@reagentai/reagent/llm/models/dummy.js";

import { runReagentWorkflow } from "../workflow.js";

type ChatInput = z.infer<(typeof ChatInputNode)["metadata"]["output"]>;

const createChatAgentRouter = (agents: Map<string, Workflow>) => {
  const router = new Hono();

  router.get("/_healthy", (c) => c.text("OK"));

  router.get("/agents", (c) => {
    return c.json(
      [...agents.entries()].map(([id, agent]) => {
        return {
          id,
          name: agent.name,
          description: agent.description,
        };
      })
    );
  });

  router.get("/agents/:agentId", (c) => {
    const agent = agents.get(c.req.param().agentId);
    if (!agent) {
      return c.notFound();
    }
    return c.json({
      name: agent.name,
      description: agent.description,
      graph: agent.generateGraph(),
    });
  });

  const invokeSchema = z.object({
    agentId: z.string().default("default"),
    nodeId: z.string(),
    input: z.object({
      id: z.string(),
      message: z.object({
        content: z.string(),
      }),
    }),
    model: z
      .object({
        provider: z.enum(["openai", "anthropic", "groq"]),
        name: z.string(),
      })
      .optional(),
  });

  router.post("/invoke", async (ctx) => {
    const body = invokeSchema.parse(await ctx.req.json());
    const agent = agents.get(body.agentId);
    if (!agent) {
      return ctx.text("Agent not found", 400);
    }

    let model: any = new DummyModel({
      response: {
        content: "Please select a AI model provider.",
      },
    });

    if (body.model?.provider == "openai") {
      model = new OpenAI({
        // @ts-expect-error
        model: body.model.name,
      });
    } else if (body.model?.provider == "anthropic") {
      model = new AnthropicChat({
        model: body.model.name,
        version: "2023-06-01",
        contextLength: 8000,
      });
    } else if (body.model?.provider == "groq") {
      model = new Groq({
        // @ts-expect-error
        model: body.model.name || "mixtral-8x7b-32768",
      });
    }

    const agentOutputStream = runReagentWorkflow<ChatInput>(agent, {
      nodeId: "input",
      input: {
        query: body.input.message.content,
        model,
      },
    });
    return agentOutputStream.toResponse();
  });

  return router;
};

export { createChatAgentRouter };
