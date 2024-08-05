import { Hono } from "hono";
import { EventType, Workflow, z } from "@reagentai/reagent/workflow";
import {
  AnthropicChat,
  Groq,
  OpenAI,
  DummyModel,
} from "@reagentai/reagent/llm/models";

import { triggerReagentWorkflow } from "../workflow.js";

const createChatWorkflowRouter = (workflows: Map<string, Workflow>) => {
  const router = new Hono();

  router.get("/_healthy", (c) => c.text("OK"));

  router.get("/workflows", (c) => {
    return c.json(
      [...workflows.entries()].map(([id, workflow]) => {
        return {
          id,
          name: workflow.name,
          description: workflow.description,
        };
      })
    );
  });

  router.get("/workflows/:workflowId", (c) => {
    const workflow = workflows.get(c.req.param().workflowId);
    if (!workflow) {
      return c.notFound();
    }
    return c.json({
      name: workflow.name,
      description: workflow.description,
      graph: workflow.generateGraph(),
    });
  });

  const invokeSchema = z.object({
    workflowId: z.string().default("default"),
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
    const workflow = workflows.get(body.workflowId);
    if (!workflow) {
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

    const outputStream = triggerReagentWorkflow(workflow, {
      events: [
        {
          type: EventType.INVOKE,
          node: { id: "input" },
          input: {
            query: body.input.message.content,
            model,
          },
        },
      ],
    });
    return outputStream.toResponse();
  });

  return router;
};

export { createChatWorkflowRouter };
