import { klona } from "klona";
import cleanSet from "clean-set";
// @ts-expect-error
import delve from "dlv";
import { AddRunableOptions, Context } from "./context";
import { FunctionRunnable, Runnable } from "./runable";
import { FormattedChatMessage } from "../prompt";

export type AbstractExecutorOptions = {
  runnables: Runnable[];
  variables?: Record<string, FunctionRunnable<any>>;
  allowRunnableOverride?: boolean;
};

export type ResolveOptions = {
  // if true, the resovler doesn't throw error if the namespace couldn't
  // be resolved
  // default: false
  optional?: boolean;
  // argument passed to runnable, if set
  argument?: any;
};

export type Plugin = (context: Context) => void;

export type InvokeConfig = Partial<{
  stream: boolean;
  temperature: number;
}>;

export type ModelInvokeOptions = InvokeConfig & {
  messages: FormattedChatMessage[];
  tools: any[];
};

export type InvokeOptions = {
  variables?: Record<string, any>;
  config?: InvokeConfig;
  plugins?: Plugin[];
};

export abstract class AbstractExecutor extends Runnable {
  #runnables: Record<string, Runnable | FunctionRunnable<unknown>>;
  #context: Context;
  constructor(options: AbstractExecutorOptions) {
    super();
    this.#context = Context.fromExecutor(null);
    this.#runnables = {};
    const self = this;
    for (const runnable of options.runnables) {
      if (
        delve(self.#runnables, runnable.namespace) &&
        !options.allowRunnableOverride
      ) {
        throw new Error(
          `Runnable already set for namespace: ${runnable.namespace}`
        );
      }
      this.#runnables = cleanSet(this.#runnables, runnable.namespace, runnable);
      const baseContext = this.#context.bindNamespace(runnable.namespace);
      const context = Object.assign(baseContext, {
        addRunnable(runnable: Runnable, options?: AddRunableOptions) {
          if (
            delve(self.#runnables, runnable.namespace) &&
            !options?.override
          ) {
            throw new Error(
              `Runnable already set for namespace: ${runnable.namespace}`
            );
          }
          self.#runnables = cleanSet(
            self.#runnables,
            runnable.namespace,
            runnable
          );
        },
        addFunctionRunnable<I>(
          namespace: string,
          runnable: FunctionRunnable<unknown, I>,
          options?: AddRunableOptions
        ) {
          const finalNamespace = baseContext.namespace
            ? `${baseContext.namespace}.${namespace}`
            : namespace;
          if (delve(self.#runnables, finalNamespace) && !options?.override) {
            throw new Error(
              `Runnable already set for namespace: ${finalNamespace}`
            );
          }

          self.#runnables = cleanSet(self.#runnables, finalNamespace, runnable);
        },
      });
      runnable.init(context);
    }

    for (const runnable of Object.entries(options.variables || {})) {
      this.#runnables = cleanSet(
        this.#runnables,
        `core.variables.${runnable[0]}`,
        runnable[1]
      );
    }
  }

  get namespace() {
    return "core.executor";
  }

  get initState() {
    return klona(this.#context.state);
  }

  async resolve(namespace: string, ctxt: Context, options: ResolveOptions) {
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
      const res = runnable(ctxt.bindNamespace(namespace), options.argument);
      if (res.then) {
        return await res;
      }
      return res;
    } else {
      throw new Error(`Invalid runnable [namespace = ${namespace}]`);
    }
  }

  async run(ctxt: Context, argument: undefined): Promise<void> {}

  abstract invoke(options: InvokeOptions): Promise<Context>;
}
