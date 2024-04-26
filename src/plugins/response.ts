import { Context } from "../core";

const createResponseSubscriber = (callback: (message: string) => void) => {
  return (context: Context) => {
    context.subscribe("core.llm.response", (state: any, prev) => {
      const message = state?.messages?.[0]?.message?.content;
      callback(message);
    });
  };
};

export { createResponseSubscriber };
