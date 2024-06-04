import invariant from "tiny-invariant";

import { InitContext } from "../../core/index.js";
import { BaseModelProvider, ModelOptions } from "../../models/base.js";
import { Metadata } from "../../models/schema.js";

const models = [
  {
    id: "gpt-3.5-turbo",
    family: "openai:gpt-3.5",
    contextLength: 16_385,
  },
  {
    id: "gpt-4-turbo",
    family: "openai:gpt-4",
    contextLength: 128_000,
  },
  {
    id: "gpt-4-turbo-preview",
    family: "openai:gpt-4",
    contextLength: 128_000,
  },
] as const;

type Options = Pick<ModelOptions, "apiKey"> & {
  model: (typeof models)[number]["id"];
};

export class OpenAI extends BaseModelProvider {
  #options: Options;
  constructor(options: Options) {
    super();
    this.#options = options;
  }

  setup(ctxt: InitContext) {
    const model = models.find((m) => m.id == this.#options.model);
    if (!model) {
      throw new Error("Invalid model: ", model);
    }
    invariant(
      this.#options.apiKey || process.env.OPENAI_API_KEY,
      "Missing API key for OpenAI. Set OPENAI_API_KEY env variable"
    );
    ctxt.setState<Metadata>("metadata", {
      provider: "openai",
      family: model.family,
      contextLength: model.contextLength,
      supportedFeatures: [
        "chat-completion",
        "image-url",
        "tool-use",
        "streaming",
        "stream-tool-use",
      ],
      request: {
        url: "https://api.openai.com/v1/chat/completions",
        headers: {
          Authorization: `Bearer ${
            this.#options.apiKey || process.env.OPENAI_API_KEY
          }`,
        },
        body: {
          model: this.#options.model,
        },
      },
    });
  }
}
