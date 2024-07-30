import { Hono } from "hono";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { createChatWorkflowRouter } from "@reagentai/serve/chat";
import { workflows } from "@reagentai/react-examples";

const app = new Hono();
app.route("/api/chat", createChatWorkflowRouter(workflows));

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
