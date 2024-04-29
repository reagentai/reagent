import { Context, Runnable } from "../core";
import { ChatCompletionResponse } from "./schema";

export type ModelOptions = {
  apiKey?: string;
  model: string;
};

export abstract class BaseModelProvider<I = unknown> extends Runnable<I> {
  get namespace() {
    return "core.llm.model";
  }

  // sub-class can implement run to handle the API call
  // to the model provider instead of using the default one
  // provided by the executor.
  // If custom `run` is implemented, the model provider should
  // call add a runnable with following inside `init`:
  //    `ctxt.addFunctionRunnable("executor", async (ctxt) => {
  //        this.run(ctxt);
  //     });`
  run(ctxt: Context, argument: I): Promise<ChatCompletionResponse> {
    throw new Error("not supported");
  }
}
