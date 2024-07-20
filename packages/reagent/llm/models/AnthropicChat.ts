import ky from "ky";
// @ts-expect-error
import delve from "dlv";
import { get } from "lodash-es";
import invariant from "tiny-invariant";

import { Context, InitContext } from "../core/index.js";
import {
  BaseModelProvider,
  ModelOptions,
  Metadata,
  ModelInvokeOptions,
} from "./core/index.js";
import { FormattedChatMessage } from "../prompt/index.js";
import { jsonStreamToAsyncIterator } from "../stream/index.js";

type Options = Pick<ModelOptions, "model"> & {
  url?: string;
  apiKey?: string;
  version: "2023-06-01" | "2023-01-01";
  contextLength: number;
};

export class AnthropicChat extends BaseModelProvider<ModelInvokeOptions> {
  #options: Options;
  constructor(options: Options) {
    super();
    this.#options = options;
  }

  setup(ctxt: InitContext) {
    ctxt.setState<Metadata>("metadata", {
      provider: "ollama",
      family: "unknown",
      contextLength: 10_000,
      supportedFeatures: ["chat-completion"],
      request: "custom",
    });

    ctxt.addFunctionRunnable(
      "executor",
      async (ctxt, argument: ModelInvokeOptions) => {
        return await this.run(ctxt, argument);
      },
      {
        override: true,
      }
    );
  }

  async run(context: Context, options: ModelInvokeOptions) {
    const systemPrompt = options.messages
      .filter((message) => message.role == "system")
      .map((message) => message.content)
      .join("\n");

    const messages = options.messages.filter(
      (message) => message.role != "system"
    );
    const formattedMessages = messages.map((message) =>
      this.#reformatMessage(message)
    );

    const payload = {
      stream: options?.stream,
      model: this.#options.model,
      system: systemPrompt,
      messages: formattedMessages,
      max_tokens: 4096,
      // tools: tools?.length > 0 ? tools : undefined,
      temperature: options?.temperature || 0.8,
    };
    context.setGlobalState("core.llm.request.body", payload);

    invariant(
      this.#options.apiKey || process.env.ANTHROPIC_API_KEY,
      "Missing API key for Anthropic. Set ANTHROPIC_API_KEY env variable"
    );
    const request = await ky.post(
      this.#options.url || "https://api.anthropic.com/v1/messages",
      {
        hooks: {
          afterResponse: [
            (_request, _options, response) => {
              context.setState("core.llm.response.status", response.status);
              return response;
            },
          ],
        },
        timeout: 10 * 60_1000,
        headers: {
          "x-api-key": this.#options.apiKey || process.env.ANTHROPIC_API_KEY,
          "anthropic-version": this.#options.version,
        },
        json: payload,
      }
    );

    let response;
    if (options?.stream) {
      const body = (await request).body!;
      const stream = jsonStreamToAsyncIterator(body);
      const builder = createStreamDeltaToResponseBuilder();
      let streamedMessages: any[] = [];
      for await (const data of stream) {
        const { json } = data;
        if (json) {
          builder.push(json);
          if (json.type == "content_block_stop") {
            stream.return();
          }
          const delta = get(json, "delta");
          if (delta) {
            if (delta.type != "text_delta" && delta.type != "end_turn") {
              throw new Error("Unsupported delta type: " + delta.type);
            }
            streamedMessages = [
              ...streamedMessages,
              {
                choices: [
                  {
                    delta: {
                      content: delta.text,
                    },
                  },
                ],
              },
            ];
            context.setGlobalState(
              "core.llm.response.stream",
              streamedMessages
            );
          }
        }
      }
      response = builder.build();
      context.setGlobalState("core.llm.response.finished", true);
    } else {
      let raw = await request.json<any>().catch(async (e) => {
        console.error(e);
        const error = await e.response.text();
        context.setGlobalState("core.llm.response.error", error);
        context.setGlobalState("core.llm.response.finished", true);
        throw e;
      });

      const contentType = delve(raw, "content.0.type");
      if (contentType != "text") {
        throw new Error("Unsupported response content type: " + contentType);
      }
      response = {
        choices: [
          {
            message: {
              role: "assistant",
              content: delve(raw, "content.0.text"),
            },
            finish_reason: raw.stop_reason,
          },
        ],
      };
    }
    return response;
  }

  #reformatMessage(message: FormattedChatMessage) {
    if (typeof message.content == "string") {
      return message;
    } else if (Array.isArray(message.content)) {
      const content = message.content.map((msg) => {
        if (msg.type == "text") {
          return {
            type: msg.type,
            text: msg.text,
          };
        } else if (msg.type == "image_url") {
          if (!msg.image_url.url.startsWith("data")) {
            throw new Error("only base64 image url supported");
          }
          const [metadata, data] = msg.image_url.url
            .substring("data:".length)
            .split(",");
          const media_type = metadata.split(";")[0];
          return {
            type: "image",
            source: {
              type: "base64",
              media_type,
              data,
            },
          };
        } else {
          throw new Error("unknown message type: " + JSON.stringify(msg));
        }
      });
      return { role: message.role, content };
    } else {
      throw new Error(
        "invalid message content format:" +
          JSON.stringify(message.content, null, 2)
      );
    }
  }
}

type StreamEvent =
  | {
      type: "message_start";
      message: {
        id: string;
        type: string; // "message"
        role: "assistant";
        model: string;
        stop_sequence: null;
        usage: { input_tokens: number; output_tokens: number };
        content: [];
        stop_reason: string | null;
      };
    }
  | {
      type: "content_block_start";
      content_block: {
        type: "text";
        text: string;
      };
    }
  | {
      type: "content_block_delta";
      delta: {
        type: "text_delta";
        text: string;
      };
    };

const createStreamDeltaToResponseBuilder = () => {
  let role: string;
  let streamContent = "";
  let streamToolCalls: any[] = [];
  return {
    push(event: StreamEvent) {
      if (event.type == "message_start") {
        role = event.message.role;
      } else if (event.type == "content_block_start") {
        if (event.content_block.type == "text") {
          const content = get(event, "content_block.text");
          if (content) {
            streamContent += content;
          }
        } else {
          throw new Error(
            "Unsupported content_block type: " + event.content_block.type
          );
        }
      } else if (event.type == "content_block_delta") {
        if (event.delta.type == "text_delta") {
          const content = get(event, "delta.text");
          if (content) {
            streamContent += content;
          }
        } else {
          throw new Error(
            "Unsupported content_block_delta type: " + event.delta.type
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
            finish_reason: "stop",
          },
        ],
      };
    },
  };
};
