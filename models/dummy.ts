import { Context, InitContext } from "../core";
import { BaseModelProvider } from "./base";
import { ChatCompletionResponse, Metadata } from "./schema";

export class DummyModel extends BaseModelProvider {
  #response: string;
  constructor(options: { response: string }) {
    super();
    this.#response = options.response;
  }

  init(ctxt: InitContext) {
    ctxt.setState<Metadata>("metadata", {
      provider: "dummy",
      family: "unknown",
      contextLength: 10_000,
      supportedFeatures: ["chat-completion"],
      request: "custom",
    });

    ctxt.addFunctionRunnable("executor", async (ctxt) => {
      return await this.run(ctxt);
    });
  }

  async run(ctxt: Context) {
    let count = 2;
    return await new Promise<ChatCompletionResponse>((resolve) => {
      let count = 0;
      const interval = setInterval(() => {
        // TODO: set `core.llm.response.messages` if streaming is on
        // ctxt.setGlobalState("core.llm.response.messages", [
        //   {
        // message: {
        //   role: "assistant",
        //   content: this.#response.substring(0, count),
        // },
        //   },
        // ]);
        if (count > this.#response.length) {
          clearInterval(interval);
          resolve({
            choices: [
              {
                message: {
                  role: "assistant",
                  content: this.#response.substring(0, count),
                },
                finish_reason: "stop",
              },
            ],
          });
        }
        count += 2;
      }, 20);
    });
  }
}
