"@reagent-skip-transform";
import { Context, InitContext, Runnable } from "../../core/index.js";
import { DefaultModelExecutor } from "./DefaultModelExecutor.js";
import { ChatCompletionResponse } from "./schema.js";

export type ModelOptions = {
  apiKey?: string;
  model: string;
};

export abstract class BaseModelProvider<
  Options = unknown,
> extends Runnable<Options> {
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
  run(ctxt: Context, argument: Options): Promise<ChatCompletionResponse> {
    throw new Error("not supported");
  }
}
