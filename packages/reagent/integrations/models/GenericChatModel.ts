import invariant from "tiny-invariant";

import { InitContext } from "../../core";
import { BaseModelProvider, ModelOptions } from "../../models/base";
import { Metadata } from "../../models/schema";

type Options = Pick<ModelOptions, "apiKey" | "model"> & {
  url: string;
  contextLength: number;
  headers?: Record<string, string>;
  body?: Record<string, any>;
};

export class GenericChatModel extends BaseModelProvider {
  #options: Options;
  constructor(options: Options) {
    super();
    this.#options = options;
  }

  setup(ctxt: InitContext) {
    invariant(this.#options.apiKey, `Missing API key for ${this.#options.url}`);
    ctxt.setState<Metadata>("metadata", {
      provider: "generic",
      family: "unknown",
      contextLength: this.#options.contextLength,
      supportedFeatures: ["chat-completion"],
      request: {
        url: this.#options.url,
        headers: {
          Authorization: this.#options.apiKey
            ? `Bearer ${this.#options.apiKey}`
            : undefined!,
          ...(this.#options.headers || {}),
        },
        body: {
          ...(this.#options.body || {}),
          model: this.#options.model,
        },
      },
    });
  }
}
