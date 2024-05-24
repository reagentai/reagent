import { get } from "lodash-es";
import { Context } from "../core";
import {
  AbstractExecutor,
  AbstractExecutorOptions,
  InvokeOptions,
} from "../core/executor";
import { ChatCompletionExecutor } from "./ChatCompletion";
import { ChatMessages } from "../prompt";

export class ToolCallExecutor extends AbstractExecutor {
  #options: AbstractExecutorOptions;
  constructor(options: AbstractExecutorOptions) {
    super({
      runnables: [],
    });
    this.#options = options;
  }

  async invoke(options: InvokeOptions = {}): Promise<Context> {
    const chatCompletionExecutor = new ChatCompletionExecutor(this.#options);
    const context = await chatCompletionExecutor.invoke(options);
    const aiResponse = get(
      context,
      "state.core.llm.response.data.choices.0.message"
    );

    const messages = await chatCompletionExecutor.resolve(
      "core.prompt.chat.messages",
      context,
      {}
    );

    const chatCompletionWithToolCallResult = new ChatCompletionExecutor({
      ...this.#options,
      runnables: [
        ...this.#options.runnables,
        ChatMessages.fromMessages([
          ...messages,
          aiResponse,
          ...aiResponse.tool_calls.map((call: any) => {
            return {
              tool_call_id: call.id,
              role: "tool",
              name: call.function.name,
              content: Math.floor(Math.random() * 100) + " deg",
            };
          }),
        ]),
      ],
      allowRunnableOverride: true,
    });

    return await chatCompletionWithToolCallResult.invoke(options);
  }
}
