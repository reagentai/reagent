import { Hono } from "hono";
import { handle } from "hono/vercel";
import { createAgentRouter } from "@reagentai/react/server/chat";
import { agents } from "@reagentai/react/demo-agents";

const app = new Hono();
app.route("/api/chat", createAgentRouter(agents));

export const GET = handle(app);
export const POST = handle(app);
