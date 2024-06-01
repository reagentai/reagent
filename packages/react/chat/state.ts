import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import type { Chat } from "@reagentai/serve/chat";

type NewMessage = {
  id: string;
  message: { content: string };
  regenerate: boolean;
};
export type ChatState = {
  messages: Record<string, Chat.Message>;
  sortedMessageIds: string[];
  setMessages: (messages: Record<string, Chat.Message>) => void;
  sendNewMessage: (message: NewMessage) => void;
};

export const createChatStore = (
  init: {
    messages: Record<string, Chat.Message>;
    sendNewMessage: (
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
          async sendNewMessage(message) {
            set((s) => {
              const state = produce(s, (state) => {
                state.messages[message.id] = {
                  id: message.id,
                  message: message.message,
                  role: "user",
                  createdAt: new Date().toISOString(),
                };
              });

              return produce(state, (state) => {
                state.sortedMessageIds = sortMessages(state.messages);
              });
            });

            const response = await init.sendNewMessage(message, get());
            for await (const msg of response) {
              if (msg.type == "message/content") {
                const message = msg.data;
                set((s) => {
                  const state = produce(s, (state) => {
                    state.messages[message.id] = message;
                  });
                  return produce(state, (state) => {
                    state.sortedMessageIds = sortMessages(state.messages);
                  });
                });
              } else if (msg.type == "message/content/delta") {
                set((s) => {
                  const data = msg.data;
                  return produce(s, (state) => {
                    state.messages[data.id].message.content =
                      (s.messages[data.id].message.content || "") +
                      data.message.content.delta;
                  });
                });
              } else if (msg.type == "message/ui") {
                const message = msg.data;
                set((s) => {
                  const state = produce(s, (state) => {
                    state.messages[message.id] = message;
                  });
                  return produce(state, (state) => {
                    state.sortedMessageIds = sortMessages(state.messages);
                  });
                });
              } else if (msg.type == "message/ui/update") {
                set((s) => {
                  const data = msg.data;
                  return produce(s, (state) => {
                    state.messages[data.id].message.ui = data.message.ui;
                  });
                });
              }
              await new Promise((r) => {
                setTimeout(() => {
                  r(null);
                }, 2);
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
