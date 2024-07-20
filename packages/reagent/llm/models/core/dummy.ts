import { Context, InitContext } from "../../core/index.js";
import { ModelInvokeOptions } from "./types.js";
import { BaseModelProvider } from "./base.js";
import { ChatCompletionResponse, Metadata } from "./schema.js";
import { uniqueId } from "../../../utils/uniqueId.js";

type ToolCallResponse = {
  tool_call: {
    name: string;
    arguments: string;
  };
};
type Response = { content: string } | ToolCallResponse;

export class DummyModel extends BaseModelProvider<ModelInvokeOptions> {
  #response: Response;
  constructor(options: { response: Response }) {
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
      let response = this.#response as ToolCallResponse;
      if (response.tool_call) {
        const result = {
          choices: [
            {
              message: {
                role: "assistant",
                tool_calls: [
                  {
                    id: uniqueId(),
                    type: "function" as const,
                    function: response.tool_call,
                  },
                ],
              },
              finish_reason: "stop",
            },
          ],
        };
        ctxt.setGlobalState("core.llm.response.stream", [result]);
        return resolve(result);
      }

      const content: string = (this.#response as any).content;
      const interval = setInterval(() => {
        // set `core.llm.response.stream` if streaming is on
        if (options.stream) {
          ctxt.setGlobalState("core.llm.response.stream", [
            {
              choices: [
                {
                  delta: {
                    content: content.substring(counter, counter + counterStep),
                  },
                },
              ],
            },
          ]);
        }
        if (counter > content.length) {
          clearInterval(interval);
          resolve({
            choices: [
              {
                message: {
                  role: "assistant",
                  content,
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
