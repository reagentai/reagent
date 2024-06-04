import invariant from "tiny-invariant";

import { InitContext } from "../../core/index.js";
import { BaseModelProvider, ModelOptions } from "../../models/base.js";
import { Metadata } from "../../models/schema.js";

const models = [
  {
    id: "llama3-8b-8192",
    family: "meta:llama-3",
    contextLength: 8192,
  },
  {
    id: "llama3-70b-8192",
    family: "meta:llama-3",
    contextLength: 8192,
  },
  {
    id: "llama2-70b-4096",
    family: "meta:llama-2",
    contextLength: 4096,
  },
  {
    id: "mixtral-8x7b-32768",
    family: "mistral:mixtral",
    contextLength: 32768,
  },
  {
    id: "gemma-7b-it",
    family: "google:gemma",
    contextLength: 8192,
  },
] as const;

type GroqModel = {
  id: string;
  family: Metadata["family"];
  contextLength: Metadata["contextLength"];
};

type Options = Pick<ModelOptions, "apiKey"> & {
  model: (typeof models)[number]["id"];
};

export class Groq extends BaseModelProvider {
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
      this.#options.apiKey || process.env.GROQ_API_KEY,
      "Missing API key for Groq. Set GROQ_API_KEY env variable"
    );
    ctxt.setState<Metadata>("metadata", {
      provider: "groq",
      family: model.family,
      contextLength: model.contextLength,
      supportedFeatures: ["chat-completion"],
      request: {
        url: "https://api.groq.com/openai/v1/chat/completions",
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
