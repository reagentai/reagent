import dlv from "dlv";
import cleanSet from "clean-set";
import { dset } from "dset";
import deepmerge from "deepmerge";

type StreamResponseDelta = {
  role?: "assistant";
  content?: string | null;
  tool_calls?: { name: string; arguments: string } | null;
};

const createOpenAIStreamDeltaToResponseBuilder = () => {
  let role: string;
  let streamContent = "";
  let streamToolCalls: any[] = [];
  return {
    push(delta: StreamResponseDelta) {
      if (delta?.role) {
        role = delta.role;
      }
      const content = dlv(delta, "content");
      if (content) {
        streamContent += content;
      }
      const toolCall = dlv(delta, "tool_calls.0");
      if (toolCall) {
        streamToolCalls = cleanSet(streamToolCalls, "0", (prev: any) => {
          const prevArgs = dlv(prev, "function.arguments") || "";
          const merged = deepmerge<any>(prev, toolCall);
          const args = dlv(toolCall, "function.arguments");
          if (args) {
            dset(merged, "function.arguments", prevArgs + args);
          }
          return merged;
        });
        if (streamToolCalls[0].type != "function") {
          throw new Error(
            'tool_call type expected "function" but got:' + toolCall.type
          );
        }
      }
    },
    build() {
      return {
        choices: [
          {
            message: {
              role: role || "assistant",
              content: streamContent.length > 0 ? streamContent : undefined,
              tool_calls:
                streamToolCalls.length > 0 ? streamToolCalls : undefined,
            },
          },
        ],
      };
    },
  };
};

export { createOpenAIStreamDeltaToResponseBuilder };
