"@reagent-skip-transform";
import { Context, InitContext, Runnable } from "../core";
import { DefaultModelExecutor } from "./DefaultModelExecutor";
import { ChatCompletionResponse } from "./schema";

export type ModelOptions = {
  apiKey?: string;
  model: string;
};

export abstract class BaseModelProvider<I = unknown> extends Runnable<I> {
  get namespace() {
    return "core.llm.model";
  }

  init(ctxt: InitContext) {
    ctxt.addRunnable(new DefaultModelExecutor());
    this.setup(ctxt);
  }

  abstract setup(ctxt: InitContext): void;

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
