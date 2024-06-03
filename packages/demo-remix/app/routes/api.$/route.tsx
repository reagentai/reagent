import { Hono } from "hono";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { createChatAgentRouter } from "@reagentai/serve/chat";
import { agents } from "@reagentai/react/demo-agents";

const app = new Hono();
app.route("/api/chat", createChatAgentRouter(agents));

export const loader = async (args: LoaderFunctionArgs) => {
  return handleRequest(args);
};

export const action = async (args: ActionFunctionArgs) => {
  return handleRequest(args);
};

async function handleRequest(args: LoaderFunctionArgs | ActionFunctionArgs) {
  const res = await app.fetch(args.request);
  return res;
}
