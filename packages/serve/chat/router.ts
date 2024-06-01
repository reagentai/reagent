import { Hono } from "hono";
import { ReplaySubject, Subject, count, take } from "rxjs";
import { uniqueId } from "@reagentai/reagent/utils/uniqueId";
import { GraphAgent, z } from "@reagentai/reagent/agent";
import { User } from "@reagentai/reagent/agent/nodes";
import {
  AnthropicChat,
  Groq,
  OpenAI,
} from "@reagentai/reagent/llm/integrations/models";
import { DummyModel } from "@reagentai/reagent/llm/models/dummy";

import type { Chat } from "./types";
import type { ChatInput } from "./input";

const createChatAgentRouter = (agents: Map<string, GraphAgent>) => {
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

  router.get("/agents/:agentId/graph", (c) => {
    console.log("param =", c.req.param().agentId);
    const agent = agents.get(c.req.param().agentId);
    if (!agent) {
      return c.notFound();
    }
    return c.json(agent.generateGraph());
  });

  const sendMessageBodySchema = z.object({
    id: z.string(),
    agentId: z.string().default("weather"),
    message: z.object({
      content: z.string(),
    }),
    model: z
      .object({
        provider: z.enum(["openai", "anthropic", "groq"]),
        name: z.string(),
      })
      .optional(),
  });

  router.post("/sendMessage", async (ctx) => {
    const body = sendMessageBodySchema.parse(await ctx.req.json());
    const replayStream = new ReplaySubject<Chat.Response>();

    let responseMessageId = uniqueId();
    replayStream.next({
      type: "message/content" as const,
      data: {
        id: responseMessageId,
        message: {
          content: "",
        },
        role: "ai",
        createdAt: new Date().toISOString(),
      },
    });

    const agent = agents.get(body.agentId);
    if (!agent) {
      return ctx.text("Agent not found", 400);
    }

    let model: any = new DummyModel({
      response: "Please select a AI model provider.",
    });
    if (body.model?.provider == "openai") {
      model = new OpenAI({
        // @ts-expect-error
        model: body.model.name,
        contextLength: 8000,
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

    const input = agent.getNode<void, ChatInput, ChatInput>("input")!;
    const user = agent.getNode<void, {}, User["_types"]["output"]>("user")!;
    const res = input.invoke({
      query: body.message.content,
      model,
    });

    const completionSubject = new Subject();
    user.output.ui.select({ runId: res.run.id }).then((stream) => {
      stream.subscribe({
        next(update) {
          replayStream.next({
            type: "message/ui/update" as const,
            data: {
              id: responseMessageId,
              message: {
                ui: {
                  node: update.node,
                  render: update.render,
                },
              },
            },
          });
        },
        complete() {
          completionSubject.next(1);
        },
        error(err) {
          console.error(err);
        },
      });
    });

    user.output.markdownStream.select({ runId: res.run.id }).then((stream) => {
      stream.subscribe({
        next(data: any) {
          replayStream.next({
            type: "message/content/delta" as const,
            data: {
              id: responseMessageId,
              message: {
                content: {
                  delta: data.delta,
                },
              },
            },
          });
        },
        complete() {
          completionSubject.next(1);
        },
        error(err) {
          console.error(err);
        },
      });
    });

    completionSubject
      .pipe(take(2))
      .pipe(count())
      .subscribe(() => {
        replayStream.complete();
      });

    const responseStream = new ReadableStream({
      async start(controller) {
        replayStream.subscribe({
          next(data) {
            try {
              controller.enqueue("data: " + JSON.stringify(data) + "\n\n");
            } catch (e) {
              console.error("Error sending message to stream:", e);
            }
          },
          complete() {
            try {
              controller.close();
            } catch (e) {
              console.error("Error closing stream:", e);
            }
          },
        });
      },
    });

    return new Response(responseStream, {
      status: 200,
      headers: [["Content-Type", "text/event-stream"]],
    });
  });

  return router;
};

export { createChatAgentRouter };
