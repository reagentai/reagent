import { dset } from "dset";
import { klona } from "klona";
// @ts-expect-error
import delve from "dlv";
import { Context } from "./context";
import { FunctionRunnable, Runnable } from "./runable";

export type AbstractExecutorOptions = {
  runnables: Runnable[];
  variables?: Record<string, FunctionRunnable<any>>;
};

export type ResolveOptions = {
  // if true, the resovler doesn't throw error if the namespace couldn't
  // be resolved
  // default: false
  optional?: boolean;
  // argument passed to runnable, if set
  argument?: any;
};

export abstract class AbstractExecutor {
  #runnables: Record<string, Runnable | FunctionRunnable<unknown>>;
  #context: Context;
  constructor(options: AbstractExecutorOptions) {
    this.#context = Context.fromExecutor(null);
    this.#runnables = {};
    const self = this;
    for (const runnable of options.runnables) {
      dset(this.#runnables, runnable.namespace, runnable);
      const baseContext = this.#context.bindNamespace(runnable.namespace);
      const context = Object.assign(baseContext, {
        addRunnable(namespace: string, runnable: any) {
          const finalNamespace = baseContext.namespace
            ? `${baseContext.namespace}.${namespace}`
            : namespace;
          self.#runnables[finalNamespace] = runnable;
        },
      });
      runnable.init(context);
    }

    for (const runnable of Object.entries(options.variables || {})) {
      dset(this.#runnables, `core.variables.${runnable[0]}`, runnable[1]);
    }
  }

  get initState() {
    return klona(this.#context.runtime.state);
  }

  async run(namespace: string, ctxt: Context, options: ResolveOptions) {
    const runnable = delve(this.#runnables, namespace);
    if (!runnable) {
      if (options.optional) {
        return undefined;
      }
      throw new Error(
        `No resolved found for "${namespace}". Required by [namespace = "${ctxt.namespace}"]`
      );
    }
    if (runnable instanceof Runnable) {
      const res = await runnable.run(
        ctxt.bindNamespace(namespace),
        options.argument
      );
      return res;
    } else if (typeof runnable == "function") {
      return runnable(ctxt.bindNamespace(namespace));
    } else {
      throw new Error("runnable must be a function or Runnable class");
    }
  }
}
