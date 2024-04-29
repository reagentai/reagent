import ky from "ky";
// @ts-expect-error
import delve from "dlv";
import { Context } from "../core";
import {
  AbstractExecutor,
  AbstractExecutorOptions,
  InvokeOptions,
} from "../core/executor";
import type { Metadata as ModelMetadata } from "../models/schema";
import { jsonStreamToAsyncIterator } from "../stream/stream";
import { createStreamDeltaToResponseBuilder } from "../stream/response-builder";

export class ChatCompletionExecutor extends AbstractExecutor {
  constructor(options: AbstractExecutorOptions) {
    super(options);
  }

  async invoke(options: InvokeOptions = {}): Promise<Context> {
    let executor = this;
    const context = Context.fromExecutor(executor);

    Object.entries(options.variables || {}).forEach(([key, value]) => {
      context.setState(`core.variables.${key}`, value);
    });

    if (options.plugins) {
      options.plugins.forEach((plugin) => {
        plugin(context);
      });
    }
    const model = await context.resolve<ModelMetadata>(
      "core.llm.model.metadata"
    );
    if (!model.supportedFeatures.includes("chat-completion")) {
      throw new Error(
        "ChatCompletionExecutor requires model with `chat-completion` feature"
      );
    }
    const messages = await context.resolve("core.prompt.chat.messages");

    const tools = await context.resolve<any>("core.prompt.tools.json", {
      optional: true,
    });

    let response;
    if (model.request == "custom") {
      response = await context.run("core.llm.model.executor", options);
    } else {
      const request = ky.post(model.request.url, {
        hooks: {
          afterResponse: [
            (_request, _options, response) => {
              context.setState("core.llm.response.status", response.status);
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
      });

      if (options.config?.stream) {
        const body = (await request).body!;
        const stream = jsonStreamToAsyncIterator(body);
        const builder = createStreamDeltaToResponseBuilder();
        let streamedMessages: any[] = [];
        for await (const data of stream) {
          const { json } = data;
          if (json) {
            const delta = delve(json, "choices.0.delta");
            builder.push(delta);
            streamedMessages = [...streamedMessages, json];
            context.setState("core.llm.response.stream", streamedMessages);
          }
        }
        response = builder.build();
      } else {
        response = await request.json<any>().catch(async (e) => {
          console.error(e);
          const error = await e.response.text();
          context.setState("core.llm.response.error", error);
          context.setState("core.llm.response.finished", true);
          throw e;
        });
      }
    }
    context.setState("core.llm.response.data", response);
    context.setState("core.llm.response.finished", true);
    return context;
  }
}
