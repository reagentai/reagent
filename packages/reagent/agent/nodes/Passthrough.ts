import { z, Context, AbstractAgentNode } from "../";
import { ZodObjectSchema } from "../types";

export default class Passthrough<
  Output extends Record<string, unknown>,
> extends AbstractAgentNode<void, Output, Output> {
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
