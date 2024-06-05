import { Context, InitContext, Runnable } from "../core/index.js";

export type SystemMesageTemplate = ["system", string];
export type AssistantMessageTemplate = ["assistant", string];
export type HumanMessageTemplate = [
  "human",
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
        },
      ]
  ),
];

type ChatMessageTemplate =
  | SystemMesageTemplate
  | AssistantMessageTemplate
  | HumanMessageTemplate;
type MessageProvider = ChatMessageTemplate | Runnable;
type FormattedChatMessage = {
  role: "system" | "assistant" | "user";
  content:
    | string
    | (
        | { type: "text"; text: string }
        | {
            type: "image_url";
            image_url: {
              url: string;
            };
          }
      )[];
};

class ChatPromptTemplate extends Runnable {
  #messages: MessageProvider[];
  #variables: string[];
  private constructor(messages: MessageProvider[]) {
    super();
    this.#messages = messages;
    this.#variables = [];
  }

  static fromMessages(messages: MessageProvider[]) {
    return new ChatPromptTemplate(messages);
  }

  get namespace() {
    return "core.prompt.chat.messages";
  }

  init(ctxt: InitContext) {
    for (const message of this.#messages) {
      // @ts-expect-error
      if (message instanceof Runnable || message.__isReagentRunnable) {
        ctxt.addRunnable(message as Runnable);
        continue;
      } else if (Array.isArray(message[1])) {
        message[1].forEach((message: any) => {
          const vars = parseTemplateVariables(
            message.text || message.image_url
          );
          vars.forEach((variable) => {
            this.#variables.push(variable);
          });
        });
      } else if (typeof message[1] == "string") {
        const vars = parseTemplateVariables(message[1]);
        vars.forEach((variable) => {
          this.#variables.push(variable);
        });
      } else {
        throw new Error(
          "Unsupported message format:" + JSON.stringify(message[1])
        );
      }
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
        const role =
          message[0] == "assistant"
            ? "assistant"
            : message[0] == "system"
              ? "system"
              : message[0] == "human"
                ? "user"
                : "unknown";
        if (role == "unknown") {
          throw new Error("Unsupported role: " + message[0]);
        }
        return [
          {
            role,
            content: this.formatMessageContent(message[1], { variables }),
          },
        ];
      })
    );
    return messages.flat();
  }

  private formatMessageContent(
    content: ChatMessageTemplate[1],
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
            image_url: {
              url: this.formatMessageContent(msg.image_url, options),
            },
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
export type { ChatMessageTemplate, FormattedChatMessage };
