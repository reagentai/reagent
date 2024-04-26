import { Context, InitContext } from "../core";
import { BaseModelProvider } from "./base";
import { Metadata } from "./schema";

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
      this.run(ctxt);
    });
  }

  async run(ctxt: Context) {
    let count = 2;
    await new Promise((resolve) => {
      let count = 0;
      const interval = setInterval(() => {
        if (count > this.#response.length) {
          clearInterval(interval);
          resolve(null);
        }
        ctxt.setGlobalState("core.llm.response.messages", [
          {
            message: {
              user: "assistant",
              content: this.#response.substring(0, count),
            },
          },
        ]);
        count += 2;
      }, 1000);
    });

    ctxt.setGlobalState("core.llm.response.messages", [
      {
        message: {
          user: "assistant",
          content: "hello there!",
        },
      },
    ]);
  }
}
