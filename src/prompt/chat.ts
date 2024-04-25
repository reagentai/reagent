import { Context, InitContext, Runnable } from "../core";

type ChatMessage =
  | [
      "system" | "user" | "ai",
      (
        | string
        | [
            {
              type: "text";
              text: string;
            },
            {
              type: "image_url";
              image_url: string;
            }
          ]
      )
    ];

type MessageProvider = ChatMessage | Runnable;

class ChatPromptTemplate extends Runnable {
  #messages: any[];
  #variables: string[];
  private constructor(messages: any[]) {
    super();
    this.#messages = messages;
    this.#variables = [];
  }

  static fromMessages(messages: MessageProvider[]) {
    return new ChatPromptTemplate(messages);
  }

  get namespace() {
    return "core.prompt.messages";
  }

  init(ctxt: InitContext) {
    for (const message of this.#messages) {
      if (message instanceof Runnable) {
        ctxt.addRunnable(message);
        continue;
      }
      const vars = parseTemplateVariables(message[1]);
      vars.forEach((variable) => {
        this.#variables.push(variable);
      });
    }
  }

  async run(ctxt: Context) {
    const variables = Object.fromEntries(
      await Promise.all(
        this.#variables.map(async (variable) => {
          return [variable, await ctxt.resolve(`core.variables.${variable}`)];
        })
      )
    );

    const messages = await Promise.all(
      this.#messages.map(async (message) => {
        if (message instanceof Runnable) {
          return await ctxt.resolve(message.namespace);
        }
        return [
          {
            role: message[0],
            content: this.formatMessageContent(message[1], { variables }),
          },
        ];
      })
    );
    return messages.flat();
  }

  private formatMessageContent(
    content: ChatMessage[1],
    options: { variables: Record<string, any> }
  ): any {
    if (typeof content == "string") {
      let messageStr = content;
      Object.entries(options.variables).forEach(([key, value]) => {
        messageStr = messageStr.replaceAll(
          new RegExp(`(?<!{)\\{${key}\\}(?!})`, "g"),
          value
        );
      });
      return messageStr;
    } else if (Array.isArray(content)) {
      return content.map((msg) => {
        if (msg.type == "text") {
          return {
            type: msg.type,
            text: this.formatMessageContent(msg.text, options),
          };
        } else if (msg.type == "image_url") {
          return {
            type: msg.type,
            image_url: this.formatMessageContent(msg.image_url, options),
          };
        } else {
          throw new Error("unknown message type: " + JSON.stringify(msg));
        }
      });
    } else {
      throw new Error(
        "invalid message content format:" + JSON.stringify(content, null, 2)
      );
    }
  }
}

const parseTemplateVariables = (template: string) => {
  const regex = [...template.matchAll(/(?<!{){(\w+)}(?!})/gm)];
  return regex.map((match) => match[1]);
};

export { ChatPromptTemplate };
export type { ChatMessage };
