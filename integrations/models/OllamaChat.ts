import ky from "ky";
import { Context, InitContext } from "../../core";
import { BaseModelProvider, ModelOptions } from "../../models";
import { Metadata } from "../../models/schema";
import { InvokeOptions } from "../../core/executor";

type Options = Pick<ModelOptions, "apiKey" | "model"> & {
  url: string;
  contextLength: number;
};

export class OllamaChat extends BaseModelProvider<InvokeOptions> {
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
    const messages = await context.resolve("core.prompt.chat.messages");
    const tools = await context.resolve<any>("core.prompt.tools.json", {
      optional: true,
    });
    const response = await ky
      .post(this.#options.url, {
        hooks: {
          afterResponse: [
            (_request, _options, response) => {
              context.setState("core.llm.response.status", response.status);
              return response;
            },
          ],
        },
        timeout: 10 * 60_1000,
        json: {
          // TODO: assert that model provider supports this
          stream: options.config?.stream || false,
          model: this.#options.model,
          messages,
          tools: tools?.length > 0 ? tools : undefined,
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
    return {
      choices: [
        {
          message: response.message,
          finish_reason: "stop",
        },
      ],
    };
  }
}
