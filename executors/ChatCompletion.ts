import { Context } from "../core";
import {
  AbstractExecutor,
  AbstractExecutorOptions,
  InvokeOptions,
} from "../core/executor";
import type { Metadata as ModelMetadata } from "../models/schema";
import { FormattedChatMessage } from "../prompt";

export class ChatCompletionExecutor extends AbstractExecutor {
  constructor(options: AbstractExecutorOptions) {
    super(options);
  }

  async invoke(options: InvokeOptions = {}): Promise<Context> {
    let executor = this;
    const context = Context.fromExecutor(executor);

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
