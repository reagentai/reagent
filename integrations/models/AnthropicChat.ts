import ky from "ky";
// @ts-expect-error
import delve from "dlv";
import { Context, InitContext } from "../../core";
import { BaseModelProvider, ModelOptions } from "../../models";
import { Metadata } from "../../models/schema";
import { InvokeOptions } from "../../core/executor";

type Options = Pick<ModelOptions, "model"> & {
  url?: string;
  apiKey: string;
  version: "2023-06-01" | "2023-01-01";
  contextLength: number;
};

export class AnthropicChat extends BaseModelProvider<InvokeOptions> {
  #options: Options;
  constructor(options: Options) {
    super();
    this.#options = options;
  }

  init(ctxt: InitContext) {
    ctxt.setState<Metadata>("metadata", {
      provider: "ollama",
      family: "unknown",
      contextLength: 10_000,
      supportedFeatures: ["chat-completion"],
      request: "custom",
    });

    ctxt.addFunctionRunnable(
      "executor",
      async (ctxt, argument: InvokeOptions) => {
        return await this.run(ctxt, argument);
      }
    );
  }

  async run(context: Context, options: InvokeOptions) {
    const allMessages = await context.resolve<any[]>(
      "core.prompt.chat.messages"
    );
    const systemPrompt = allMessages
      .filter((message) => message.role == "system")
      .map((message) => message.content)
      .join("\n");

    const messages = allMessages.filter((message) => message.role != "system");

    const tools = await context.resolve<any>("core.prompt.tools.json", {
      optional: true,
    });
    const response = await ky
      .post(this.#options.url || "https://api.anthropic.com/v1/messages", {
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
          "x-api-key": this.#options.apiKey,
          "anthropic-version": this.#options.version,
        },
        json: {
          stream: options.config?.stream,
          model: this.#options.model,
          system: systemPrompt,
          messages,
          max_tokens: 4096,
          // tools: tools?.length > 0 ? tools : undefined,
          temperature: options.config?.temperature || 0.8,
        },
      })

      .json<any>()
      .catch(async (e) => {
        const error = await e.response.text();
        context.setState("core.llm.response.error", error);
        context.setState("core.llm.response.finished", true);
        throw e;
      });

    const contentType = delve(response, "content.0.type");
    if (contentType != "text") {
      throw new Error("Unsupported response content type: " + contentType);
    }
    return {
      choices: [
        {
          message: {
            role: "assistant",
            content: delve(response, "content.0.text"),
          },
          finish_reason: response.stop_reason,
        },
      ],
    };
  }
}
