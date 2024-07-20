import { klona } from "klona";

import { Context } from "../core/index.js";
import {
  AbstractExecutor,
  AbstractExecutorOptions,
  InvokeOptions,
  RunInfo,
} from "../core/executor.js";
import type { Metadata as ModelMetadata } from "../models/index.js";
import { FormattedChatMessage } from "../prompt/index.js";
import { uniqueId } from "../../utils/uniqueId.js";

export class ChatCompletionExecutor extends AbstractExecutor {
  constructor(options: AbstractExecutorOptions) {
    super(options);
  }

  async invoke(options: InvokeOptions = {}): Promise<Context> {
    let executor = this;
    const context = Context.fromExecutor(executor);

    const run = klona(options.run || ({} as RunInfo));
    if (!run.id) {
      run.id = uniqueId(20);
    }
    context.setGlobalState(`core.run`, run);

    Object.entries(options.variables || {}).forEach(([key, value]) => {
      context.setGlobalState(`core.variables.${key}`, value);
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

    const messages = await context.resolve<FormattedChatMessage[]>(
      "core.prompt.chat.messages"
    );
    const tools = await context.resolve<any>("core.prompt.tools.json", {
      optional: true,
    });
    const modelInvokeOptions = {
      stream: options.config?.stream,
      temperature: options.config?.temperature,
      messages,
      tools,
    };
    try {
      const response = await context.run(
        "core.llm.model.executor",
        modelInvokeOptions
      );
      context.setGlobalState("core.llm.response.data", response);
    } catch (error: any) {
      context.setGlobalState("core.llm.response.error", error);
      error.context = context;
      throw error;
    }
    context.setGlobalState("core.llm.response.finished", true);
    return context;
  }
}
