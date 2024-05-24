// @ts-expect-error
import delve from "dlv";
import { Context } from "../core";

const parseStringResponse = (context: Context) => {
  return delve(
    context.state,
    "core.llm.response.data.choices.0.message.content"
  );
};

// Returns the delta string of message stream
const createStreamDeltaStringSubscriber = (
  callback: (message: string) => void
) => {
  return (context: Context) => {
    context.subscribe("core.llm.response.stream", (stream: any) => {
      if (stream.length > 0) {
        const delta = stream[stream.length - 1]?.choices?.[0]?.delta?.content;
        if (delta != undefined) {
          callback(delta);
        }
      }
    });
  };
};

const createStringResponseSubscriber = (
  callback: (message: string) => void
) => {
  return (context: Context) => {
    context.subscribe("core.llm.response.data", (data: any, prev) => {
      const message = data?.choices?.[0]?.message?.content;
      if (message) {
        callback(message);
      }
    });
  };
};

export {
  createStreamDeltaStringSubscriber,
  createStringResponseSubscriber,
  parseStringResponse,
};
