import { Context, InitContext } from "./context";

export abstract class Runnable<I = undefined, O = unknown> {
  abstract get namespace(): string;

  abstract init(ctxt: InitContext): void;

  abstract run(ctxt: Context, argument: I): Promise<O>;
}

export type FunctionRunnable<T> = (ctxt: Context) => T | Promise<T>;
