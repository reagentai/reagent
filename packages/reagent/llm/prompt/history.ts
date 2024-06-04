import { Context, InitContext, Runnable } from "../core/index.js";

export class MessagesPlaceholder extends Runnable {
  variable: string;
  /**
   * Create a messages palceholder that uses value of
   * `core.variables.{variable}` when the messages template
   * is formatted
   * @param variable
   */
  constructor(variable: string) {
    super();
    this.variable = variable;
  }

  get namespace(): string {
    return "core.prompt.history.messages";
  }

  init(ctxt: InitContext): void {}

  async run(ctxt: Context) {
    const history = await ctxt.resolve(`core.variables.${this.variable}`);
    return history;
  }
}
