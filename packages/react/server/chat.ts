import { Hono } from "hono";
import { ReplaySubject, Subject, count, take } from "rxjs";
import { uniqueId } from "@portal/reagent/utils/uniqueId";
import { z } from "@portal/reagent/agent";
import { User } from "@portal/reagent/agent/nodes";

import { Chat } from "../chat/types";
import { Input } from "../demo-agents/input";
import { agent as chatAgent } from "../demo-agents/chat";
import { agent as weatherAgent } from "../demo-agents/weather";
import {
  AnthropicChat,
  GenericChatModel,
  Groq,
} from "@portal/reagent/llm/integrations/models";
import { DummyModel } from "@portal/reagent/llm/models/dummy";

const router = new Hono();

router.get("/_healthy", (c) => c.text("OK"));

const agentsById = new Map([
  ["chat", chatAgent],
  ["weather", weatherAgent],
]);

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

  const agent = agentsById.get(body.agentId);
  if (!agent) {
    return ctx.text("Agent not found", 400);
  }

  const input = agent.getNode<void, Input, Input>("input")!;
  const user = agent.getNode<void, {}, User["_types"]["output"]>("user")!;

  let model: any = new DummyModel({
    response: "Please set the AI model provider.",
  });
  if (body.model?.provider == "openai") {
    model = new GenericChatModel({
      url: "https://api.openai.com/v1/chat/completions",
      apiKey: process.env.OPENAI_API_KEY,
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
      model: body.model.name || "mixtral-8x7b-32768",
    });
  }

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

export { router };
