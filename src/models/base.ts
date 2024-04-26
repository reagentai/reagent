import { Context, Runnable } from "../core";

export type ModelOptions = {
  apiKey?: string;
  model: string;
};

export abstract class BaseModelProvider extends Runnable {
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
  run(ctxt: Context): Promise<void> {
    throw new Error("not supported");
  }
}
