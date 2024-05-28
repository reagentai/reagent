import { Hono } from "hono";
import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { router as chatRouter } from "@portal/reagent-react/server/chat";

const app = new Hono().basePath("/api");

app.route("/chat", chatRouter);

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
