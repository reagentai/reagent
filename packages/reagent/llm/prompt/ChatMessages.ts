import { Context, InitContext, Runnable } from "../core/index.js";
import { FormattedChatMessage } from "./ChatTemplate.js";

export class ChatMessages extends Runnable {
  #messages: FormattedChatMessage[];
  private constructor(messages: FormattedChatMessage[]) {
    super();
    this.#messages = messages;
  }

  static fromMessages(messages: FormattedChatMessage[]) {
    return new ChatMessages(messages);
  }

  get namespace() {
    return "core.prompt.chat.messages";
  }

  init(ctxt: InitContext) {}

  async run(ctxt: Context) {
    return this.#messages;
  }
}
