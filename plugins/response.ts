// @ts-expect-error
import delve from "dlv";
import { Context } from "../core";

const parseStringResponse = (context: Context) => {
  return delve(
    context.state,
    "core.llm.response.data.choices.0.message.content"
  );
};

const createStringResponseSubscriber = (
  callback: (message: string) => void
) => {
  return (context: Context) => {
    context.subscribe("core.llm.response", (state: any, prev) => {
      const message = state?.data.choices?.[0]?.message?.content;
      callback(message);
    });
  };
};

export { createStringResponseSubscriber, parseStringResponse };
