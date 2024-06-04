import ky from "ky";
import { get } from "lodash-es";

import { Context } from "../core/index.js";
import { ModelInvokeOptions } from "../core/executor.js";
import { Metadata } from "./schema.js";
import { jsonStreamToAsyncIterator } from "../stream/stream.js";
import { createOpenAIStreamDeltaToResponseBuilder } from "../stream/response-builder.js";
import { BaseModelExecutor } from "./BaseModelExecutor.js";

/**
 * This is a default model executor that's compatible with OpenAI API
 */
export class DefaultModelExecutor extends BaseModelExecutor {
  async run(context: Context, options: ModelInvokeOptions) {
    const model = await context.resolve<Metadata>("core.llm.model.metadata");

    if (model.request == "custom") {
      throw new Error("Custom Model should be used when request = `custom`");
    }
    const payload = {
      ...(model.request.body || {}),
      messages: options.messages,
      tools: options.tools?.length! > 0 ? options.tools : undefined,
      // TODO: assert that model provider supports this
      stream: options?.stream,
      temperature: options?.temperature || 0.8,
    };

    context.setGlobalState("core.llm.request.body", payload);
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

    if (options?.stream) {
      const response = await request;
      const body = response.body!;
      if (response.status != 200) {
        throw new Error(await response.text(), {
          cause: response,
        });
      }
      const stream = jsonStreamToAsyncIterator(body);
      const builder = createOpenAIStreamDeltaToResponseBuilder();
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
