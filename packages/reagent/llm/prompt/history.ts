import { Context, InitContext, Runnable } from "../core";

export class MessagesPlaceholder extends Runnable {
  variable: string;
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
