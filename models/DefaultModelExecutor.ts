import ky from "ky";
import { get } from "lodash-es";
import { Context } from "../core";
import { InvokeOptions } from "../core/executor";
import { BaseModelExecutor } from "./base";
import { Metadata } from "./schema";
import { jsonStreamToAsyncIterator } from "../stream/stream";
import { createStreamDeltaToResponseBuilder } from "../stream/response-builder";

/**
 * This is a default model executor that's compatible with OpenAI API
 */
export class DefaultModelExecutor extends BaseModelExecutor {
  async run(context: Context, options: InvokeOptions) {
    const model = await context.resolve<Metadata>("core.llm.model.metadata");
    const messages = await context.resolve("core.prompt.chat.messages");
    const tools = await context.resolve<any>("core.prompt.tools.json", {
      optional: true,
    });

    if (model.request == "custom") {
      throw new Error("Custom Model should be used when request = `custom`");
    }
    const payload = {
      ...(model.request.body || {}),
      messages,
      tools: tools?.length > 0 ? tools : undefined,
      // TODO: assert that model provider supports this
      stream: options.config?.stream,
      temperature: options.config?.temperature || 0.8,
    };

    context.setGlobalState("core.llm.request", payload);
    const request = ky.post(model.request.url, {
      hooks: {
        afterResponse: [
          (_request, _options, response) => {
            context.setGlobalState("core.llm.response.status", response.status);
            return response;
          },
        ],
      },
      timeout: 10 * 60_1000,
      headers: model.request.headers,
      json: payload,
    });

    if (options.config?.stream) {
      const body = (await request).body!;
      const stream = jsonStreamToAsyncIterator(body);
      const builder = createStreamDeltaToResponseBuilder();
      let streamedMessages: any[] = [];
      for await (const data of stream) {
        const { json } = data;
        if (json) {
          const delta = get(json, "choices.0.delta");
          builder.push(delta);
          streamedMessages = [...streamedMessages, json];
          context.setGlobalState("core.llm.response.stream", streamedMessages);
        }
      }
      return builder.build();
    } else {
      return await request.json<any>().catch(async (e) => {
        const msg = await e.response.text();
        throw new Error(msg, {
          cause: e,
        });
      });
    }
  }
}
