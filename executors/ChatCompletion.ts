import { Context } from "../core";
import {
  AbstractExecutor,
  AbstractExecutorOptions,
  InvokeOptions,
} from "../core/executor";
import type { Metadata as ModelMetadata } from "../models/schema";
import { DefaultModelExecutor } from "../models/DefaultModelExecutor";

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

    try {
      let response;
      if (model.request == "custom") {
        response = await context.run("core.llm.model.executor", options);
      } else {
        const executor = new DefaultModelExecutor();
        response = await executor.run(context, options);
      }
      context.setGlobalState("core.llm.response.data", response);
    } catch (error) {
      console.error(error);
      context.setGlobalState("core.llm.response.error", error);
    }
    context.setGlobalState("core.llm.response.finished", true);
    return context;
  }
}
