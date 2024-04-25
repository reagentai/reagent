import cleanSet from "clean-set";
// @ts-expect-error
import delve from "dlv";
import { AbstractExecutor, ResolveOptions } from "./executor";
import { FunctionRunnable, Runnable } from "./runable";
import { dset } from "dset";

export class Runtime {
  state: any;
  subscribers: Record<string, StateChangeSubscriber<unknown>>;
  constructor(options: { state: any }) {
    this.state = options.state;
    this.subscribers = {};
  }
}

export type StateChangeSubscriber<S> = (state: S, prev: any) => void;

export class Context {
  #executor: AbstractExecutor | null;
  #runtime: Runtime;
  #namespace: string | undefined;
  private constructor(options: {
    executor: AbstractExecutor | null;
    runtime: Runtime;
    namespace?: string;
  }) {
    this.#executor = options.executor;
    this.#runtime = options.runtime;
    this.#namespace = options.namespace;
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
    const state = delve(this.#runtime.state, namespace);
    if (state) {
      return state;
    }

    if (!this.#executor) {
      throw new Error("Unexpected error: executor isn't set for this context");
    }
    const value = await this.#executor.run(namespace, this, options);
    if (value != undefined) {
      this.setGlobalState(namespace, value);
    }
    return value;
  }

  /**
   * Explicity run the runnable corresponding to the runnable
   */
  async run<Output>(namespace: string, argument?: any): Promise<Output> {
    if (!this.#executor) {
      throw new Error("Unexpected error: executor isn't set for this context");
    }
    return await this.#executor.run(namespace, this, {
      argument,
    });
  }

  get state() {
    return this.#runtime.state;
  }

  get namespace() {
    return this.#namespace;
  }

  setState<T>(namespace: string, value: T) {
    const finalNamespace = this.#namespace
      ? `${this.#namespace}.${namespace}`
      : namespace;
    this.setGlobalState(finalNamespace, value);
  }

  setGlobalState<T>(namespace: string, value: T) {
    const prevState = this.#runtime.state;
    const ns = namespace.split(".");
    const newState = cleanSet(this.#runtime.state, ns, (prev) => {
      return value;
    });
    this.#runtime.state = newState;

    // notify subscribers
    const len = ns.length;
    const stack = [...ns];
    for (let i = 0; i < len; i++) {
      const subscribers = delve(this.#runtime.subscribers, stack);
      const callbacks = subscribers?._cbs;
      if (callbacks) {
        callbacks.forEach((callback: any) => {
          callback(delve(newState, stack), delve(prevState, stack));
        });
      }
      stack.pop();
    }
  }

  bindNamespace(namespace: string) {
    return new Context({
      executor: this.#executor,
      runtime: this.#runtime,
      namespace,
    });
  }

  // subscribe to state change
  subscribe<S>(namespace: string, callback: StateChangeSubscriber<S>) {
    const subscribers = delve(this.#runtime.subscribers, namespace);
    if (subscribers) {
      subscribers["_cbs"].push(callback);
    } else {
      dset(this.#runtime.subscribers, namespace, {
        _cbs: [callback],
      });
    }
  }
}

export type InitContext = Pick<Context, "setState"> & {
  // adds the runnable to the context in the namespace of the runnable
  addRunnable(runnable: Runnable): void;

  // adds the function runnable to the context in the given namespace
  // prefixed by the namespace of the runnable adding the new runnnable
  addFunctionRunnable(
    namespace: string,
    runnable: FunctionRunnable<unknown>
  ): void;
};
