import { z, Context, AbstractAgentNode, ZodObjectSchema } from "../";

export default class Passthrough<
  Output extends ZodObjectSchema,
> extends AbstractAgentNode<z.ZodVoid, Output, Output> {
  #schema: Output;
  constructor(schema: Output) {
    super();
    this.#schema = schema;
  }

  get metadata() {
    return {
      id: "@core/input",
      version: "0.0.1",
      name: "Input",
      config: z.void(),
      input: this.#schema,
      output: this.#schema,
    };
  }

  // @ts-expect-error
  async *run(
    _context: Context<z.infer<z.ZodVoid>, z.infer<Output>>,
    input: z.infer<Output>
  ) {
    yield input;
  }
}
