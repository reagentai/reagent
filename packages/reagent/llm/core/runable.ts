import { Context, InitContext } from "./context.js";

export abstract class Runnable<I = unknown, O = unknown> {
  // if this package isn't deduped properly, instanceof won't work
  // so use this to check if an object is runnable
  get __isReagentRunnable() {
    return true;
  }

  abstract get namespace(): string;

  init(ctxt: InitContext): void {}

  abstract run(ctxt: Context, argument: I): Promise<O>;
}

export type FunctionRunnable<T, I = undefined> = (
  ctxt: Context,
  argument: I
) => T | Promise<T>;
