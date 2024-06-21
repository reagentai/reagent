import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import type { Chat } from "@reagentai/reagent/chat";

type NewMessage = {
  id: string;
  node: Chat.Message["node"];
  message: { content: string };
  regenerate: boolean;
};
export type ChatState = {
  messages: Record<string, Chat.Message>;
  sortedMessageIds: string[];
  setMessages: (messages: Record<string, Chat.Message>) => void;
  invoke: (nodeId: string, message: NewMessage) => void;
};

export const createChatStore = (
  init: {
    messages: Record<string, Chat.Message>;
    invoke: (
      nodeId: string,
      message: NewMessage,
      state: ChatState
    ) => Promise<Chat.ResponseStream>;
  },
  options?: {
    persistKey?: string;
  }
) => {
  const withPerisist: typeof persist = options?.persistKey
    ? persist
    : (x: any) => {
        return x;
      };
  return create(
    withPerisist<ChatState>(
      (set, get) => {
        const sortMessages = (messages: Record<string, Chat.Message>) => {
          return Object.values(messages)
            .sort((m1, m2) => {
              const d1 = new Date(m1.createdAt).getTime();
              const d2 = new Date(m2.createdAt).getTime();
              if (d1 == d2) {
                return 0;
              } else if (d1 > d2) {
                return 1;
              } else {
                return -1;
              }
            })
            .map((m) => m.id);
        };

        return {
          messages: init.messages,
          sortedMessageIds: sortMessages(init.messages),
          setMessages(messages: Record<string, Chat.Message>) {
            set(
              produce((state) => {
                state.messages = messages;
                state.sortedMessageIds = sortMessages(messages);
              })
            );
          },
          async invoke(nodeId: string, message) {
            set((s) => {
              const state = produce(s, (state) => {
                state.messages[message.id] = {
                  id: message.id,
                  message: message.message,
                  node: message.node,
                  role: "user",
                  createdAt: new Date().toISOString(),
                };
              });

              return produce(state, (state) => {
                state.sortedMessageIds = sortMessages(state.messages);
              });
            });

            const response = await init.invoke(nodeId, message, get());
            for await (const msg of response) {
              set((s) => {
                let state: ChatState;
                if (msg.type == "message/content") {
                  const message = msg.data;
                  state = produce(s, (state) => {
                    state.messages[message.id] = message;
                  });
                } else if (msg.type == "message/content/delta") {
                  const data = msg.data;
                  state = produce(s, (state) => {
                    if (s.messages[data.id]) {
                      state.messages[data.id].message.content =
                        (s.messages[data.id].message.content || "") +
                        data.message.content;
                    } else {
                      state.messages[data.id] = data;
                    }
                  });
                } else if (msg.type == "message/ui") {
                  state = produce(s, (state) => {
                    state.messages[message.id] = msg.data;
                  });
                } else if (msg.type == "message/ui/update") {
                  const data = msg.data;
                  state = produce(s, (state) => {
                    state.messages[data.id] = data;
                  });
                } else {
                  throw new Error("unknown message type:" + (msg as any).type);
                }
                return produce(state, (state: any) => {
                  state.sortedMessageIds = sortMessages(state.messages);
                });
              });
            }
          },
        };
      },
      {
        name: options?.persistKey!,
      }
    )
  );
};

export type ChatStore = ReturnType<typeof createChatStore>;
