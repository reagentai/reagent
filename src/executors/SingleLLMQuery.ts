import ky from "ky";
import { pick } from "lodash-es";
import { Context } from "../core";
import {
  AbstractExecutor,
  AbstractExecutorOptions,
  InvokeOptions,
} from "../core/executor";
import type { Metadata as ModelMetadata } from "../models/schema";
import * as modelSchema from "../models/schema";

export class SimpleExecutor extends AbstractExecutor {
  constructor(options: AbstractExecutorOptions) {
    super(options);
  }

  async invoke(input: string, options: InvokeOptions = {}) {
    let executor = this;
    const context = Context.fromExecutor(executor);
    context.setState("core.variables.input", input);

    if (options.plugins) {
      options.plugins.forEach((plugin) => {
        plugin(context);
      });
    }

    const messages = await context.resolve("core.prompt.messages");
    const model = await context.resolve<ModelMetadata>(
      "core.llm.model.metadata"
    );

    const tools = await context.resolve<any>("core.prompt.tools.json", {
      optional: true,
    });

    if (model.request == "custom") {
      await context.run("core.llm.model.executor");
      return;
    }

    const response = await ky
      .post(model.request.url, {
        hooks: {
          afterResponse: [
            (_request, _options, response) => {
              context.setState("core.llm.response.raw.status", response.status);
              return response;
            },
          ],
        },
        timeout: 10 * 60_1000,
        headers: model.request.headers,
        json: {
          ...model.request.body,
          messages,
          tools: tools?.length > 0 ? tools : undefined,
          // TODO: assert that model provider supports this
          stream: options.config?.stream,
          temperature: options.config?.temperature || 0.8,
        },
      })

      .json<any>()
      .catch(async (e) => {
        const error = await e.response.text();
        context.setState("core.llm.response.raw.error", error);
        context.setState("core.llm.response.finished", true);
        throw e;
      });

    context.setState("core.llm.response.raw.data", response);
    if (model.supportedFeatures.includes("chat-completion")) {
      const chatResponse = modelSchema.chatCompletionResponse.parse(response);
      context.setState(
        "core.llm.response.messages",
        chatResponse.choices.map((c) =>
          pick(c, "message", "logprobs", "finish_reason")
        )
      );
    } else {
      throw new Error("Only 'chat-completion' is supported");
    }
    context.setState("core.llm.response.finished", true);
  }
}
