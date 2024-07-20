import { z, Context, AbstractWorkflowNode } from "../index.js";
import type { ZodObjectSchema } from "../core/zod.js";

export default class Passthrough<
  Output extends Record<string, unknown>,
> extends AbstractWorkflowNode<void, Output, Output> {
  #schema: ZodObjectSchema<Output>;
  constructor(schema: ZodObjectSchema<Output>) {
    super();
    this.#schema = schema;
  }

  get metadata() {
    return {
      id: "@core/passthrough",
      version: "0.0.1",
      name: "Passthrough",
      config: z.object({}),
      input: this.#schema,
      output: this.#schema,
    };
  }

  // @ts-expect-error
  async *execute(_context: Context<void, Output>, input: Output) {
    yield input;
  }
}
