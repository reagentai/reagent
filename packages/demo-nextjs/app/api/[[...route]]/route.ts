import { Hono } from "hono";
import { handle } from "hono/vercel";
import { router as chatRouter } from "@portal/reagent-react/server/chat";

const app = new Hono().basePath("/api");

app.route("/chat", chatRouter);

export const GET = handle(app);
export const POST = handle(app);
