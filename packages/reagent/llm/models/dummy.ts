import { Context, InitContext } from "../core";
import { ModelInvokeOptions } from "../core/executor";
import { BaseModelProvider } from "./base";
import { ChatCompletionResponse, Metadata } from "./schema";

export class DummyModel extends BaseModelProvider {
  #response: string;
  constructor(options: { response: string }) {
    super();
    this.#response = options.response;
  }

  setup(ctxt: InitContext) {
    ctxt.setState<Metadata>("metadata", {
      provider: "dummy",
      family: "unknown",
      contextLength: 10_000,
      supportedFeatures: ["chat-completion"],
      request: "custom",
    });

    ctxt.addFunctionRunnable(
      "executor",
      async (ctxt, options: ModelInvokeOptions) => {
        return await this.run(ctxt, options);
      },
      {
        override: true,
      }
    );
  }

  async run(ctxt: Context, options: ModelInvokeOptions) {
    return await new Promise<ChatCompletionResponse>((resolve) => {
      let counter = 0;
      let counterStep = 3;
      const interval = setInterval(() => {
        // set `core.llm.response.stream` if streaming is on
        if (options.stream) {
          ctxt.setGlobalState("core.llm.response.stream", [
            {
              choices: [
                {
                  delta: {
                    content: this.#response.substring(
                      counter,
                      counter + counterStep
                    ),
                  },
                },
              ],
            },
          ]);
        }
        if (counter > this.#response.length) {
          clearInterval(interval);
          resolve({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: this.#response,
                },
                finish_reason: "stop",
              },
            ],
          });
        }
        counter += counterStep;
      }, 20);
    });
  }
}
