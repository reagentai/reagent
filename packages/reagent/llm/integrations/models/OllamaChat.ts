import ky from "ky";

import { Context, InitContext } from "../../core/index.js";
import { BaseModelProvider, ModelOptions } from "../../models/index.js";
import { Metadata } from "../../models/schema.js";
import { ModelInvokeOptions } from "../../core/executor.js";

type Options = Pick<ModelOptions, "apiKey" | "model"> & {
  url: string;
  contextLength: number;
};

export class OllamaChat extends BaseModelProvider<ModelInvokeOptions> {
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
      }
    );
  }

  async run(context: Context, options: ModelInvokeOptions) {
    const payload = {
      // TODO: assert that model provider supports this
      stream: options?.stream || false,
      model: this.#options.model,
      messages: options.messages!,
      tools: options.tools?.length! > 0 ? options.tools : undefined,
      temperature: options?.temperature || 0.8,
    };
    context.setGlobalState("core.llm.request.body", payload);
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
        json: payload,
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
