import { Context, InitContext, Runnable } from "../core";
import { ModelInvokeOptions } from "../core/executor";
import { ChatCompletionResponse } from "./schema";

export type ModelOptions = {
  apiKey?: string;
  model: string;
};

export abstract class BaseModelExecutor extends Runnable<ModelInvokeOptions> {
  get namespace() {
    return "core.llm.model.executor";
  }

  init(ctxt: InitContext) {}

  run(
    ctxt: Context,
    argument: ModelInvokeOptions
  ): Promise<ChatCompletionResponse> {
    throw new Error("not implemented");
  }
}
