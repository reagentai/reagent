import delve from "dlv";

import { Context } from "../core/index.js";

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: Record<string, any>;
  };
  index: number;
};

const parseStringResponse = (context: Context) => {
  return delve(
    context,
    "state.core.llm.response.data.choices.0.message.content"
  );
};

const parseStringErrorMessage = (context: Context) => {
  const error = delve(context, "state.core.llm.response.error");
  return error?.message;
};

const parseToolCallsResponse = (context: Context): ToolCall[] | undefined => {
  const toolCalls = delve(
    context,
    "state.core.llm.response.data.choices.0.message.tool_calls"
  );

  if (!toolCalls) {
    return toolCalls;
  }

  return toolCalls.map((tool: any) => {
    return {
      ...tool,
      function: {
        name: tool.function.name,
        arguments: JSON.parse(tool.function.arguments),
      },
    };
  });
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
  parseStringErrorMessage,
  parseToolCallsResponse,
};
export type { ToolCall };
