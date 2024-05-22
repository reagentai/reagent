import { Hono } from "hono";
import { ReplaySubject } from "rxjs";
import { uniqueId } from "@portal/cortex/utils/uniqueId";
import { z } from "@portal/cortex/agent";

import { Chat } from "../chat/types";
const router = new Hono();

router.get("/_healthy", (c) => c.text("OK"));

const sendMessageBodySchema = z.object({
  id: z.string(),
  agentId: z.string(),
  message: z.object({
    content: z.string(),
  }),
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

  //   const agent = await loadAgentGraph(body.agentId);
  //   await executeGraph(responseMessageId, replayStream, body.message, agent);
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

  replayStream.next({
    type: "message/content/delta" as const,
    data: {
      id: responseMessageId,
      message: {
        content: {
          delta: "Who are you?",
        },
      },
    },
  });

  return new Response(responseStream, {
    status: 200,
    headers: [["Content-Type", "text/event-stream"]],
  });
});

export { router };
