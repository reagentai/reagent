import cleanSet from "clean-set";
// @ts-expect-error
import delve from "dlv";
import { AbstractExecutor, ResolveOptions } from "./executor";
import { FunctionRunnable, Runnable } from "./runable";

export class Runtime {
  state: any;
  constructor(options: { state: any }) {
    this.state = options.state;
  }
}

export class Context {
  executor: AbstractExecutor | null;
  runtime: Runtime;
  namespace: string | undefined;
  private constructor(options: {
    executor: AbstractExecutor | null;
    runtime: Runtime;
    namespace?: string;
  }) {
    this.executor = options.executor;
    this.runtime = options.runtime;
    this.namespace = options.namespace;
  }

  static fromExecutor(executor: AbstractExecutor | null) {
    return new Context({
      executor,
      runtime: new Runtime({
        state: executor?.initState || {},
      }),
    });
  }

  async resolve<Output>(
    namespace: string,
    options: ResolveOptions = {}
  ): Promise<Output> {
    const state = delve(this.runtime.state, namespace);
    if (state) {
      return state;
    }

    if (!this.executor) {
      throw new Error("Unexpected error: executor isn't set for this context");
    }
    const resolved = await this.executor.run(namespace, this, options);
    if (resolved != undefined) {
      this.setState(namespace, resolved);
    }
    return resolved;
  }

  get state() {
    return this.runtime.state;
  }

  setState<T>(namespace: string, value: T) {
    const finalNamespace = this.namespace
      ? `${this.namespace}.${namespace}`
      : namespace;
    const newState = cleanSet(this.runtime.state, finalNamespace, value);
    this.runtime.state = newState;
  }

  bindNamespace(namespace: string) {
    return new Context({
      executor: this.executor,
      runtime: this.runtime,
      namespace,
    });
  }
}

export type InitContext = Pick<Context, "setState"> & {
  addRunnable(
    namespace: string,
    runnable: Runnable | FunctionRunnable<unknown>
  ): void;
};
