import { InitContext } from "../../core";
import { BaseModelProvider, ModelOptions } from "../../models/base";
import { Metadata } from "../../models/schema";

type Options = Pick<ModelOptions, "apiKey" | "model"> & {
  endpoint?: string;
  family: Metadata["family"];
  contextLength: Metadata["contextLength"];
};

export class LMStudio extends BaseModelProvider {
  #options: Options;
  constructor(options: Options) {
    super();
    this.#options = options;
  }

  setup(ctxt: InitContext) {
    ctxt.setState<Metadata>("metadata", {
      provider: "lmstudio",
      family: this.#options.family,
      contextLength: this.#options.contextLength,
      supportedFeatures: ["chat-completion"],
      request: {
        url:
          this.#options.endpoint || "http://localhost:1234/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${
            this.#options.apiKey || process.env.GROQ_API_KEY
          }`,
        },
        body: {
          model: this.#options.model,
        },
      },
    });
  }
}
