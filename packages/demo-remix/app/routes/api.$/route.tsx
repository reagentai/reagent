import { Hono } from "hono";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { createAgentRouter } from "@useportal/reagent-react/server/chat";
import { agents } from "@useportal/reagent-react/demo-agents";

const app = new Hono();
app.route("/api/chat", createAgentRouter(agents));

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
