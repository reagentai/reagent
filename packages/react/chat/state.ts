import { create } from "zustand";
import { persist } from "zustand/middleware";
import { produce } from "immer";
import { createWorkflowClient } from "@reagentai/client/workflow";
import type { Chat } from "@reagentai/reagent/chat";
import type { BaseReagentNodeOptions } from "@reagentai/reagent";

type NewMessage = {
  id: string;
  node: Chat.Message["node"];
  message: { content: string };
  regenerate: boolean;
};

export type ChatState = {
  messages: Record<string, Chat.Message>;
  persistentStateByMessageId: Record<string, any>;
  sortedMessageIds: string[];
  setMessages: (messages: Record<string, Chat.Message>) => void;
  setPersistentState(options: { messageId: string; state: any }): void;
  invoke: (options: { nodeId: string; input: NewMessage }) => void;
};

export type InvokeOptions = {
  nodeId: string;
  input: NewMessage;
  state: ChatState;
};

type StoreInit = {
  messages: Record<string, Chat.Message>;
  // workflow execution url
  url: string;
  templates: BaseReagentNodeOptions<any, any, any>[];
  middleware?: {
    request: (options: InvokeOptions) => { nodeId: string; input: any };
  };
  onInvokeError?: (res: Response) => void | Promise<void>;
};

export const createChatStore = (
  init: StoreInit,
  options?: {
    persistKey?: string;
  }
) => {
  const client = createWorkflowClient({
    http: {
      url: init.url,
      headers: {
        "content-type": "application/json",
      },
    },
    templates: init.templates,
  });

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
          // persistent state of a node
          // since each message can have only one UI node, store
          // state by message id
          persistentStateByMessageId: {
            // [messageId]: state
          },
          sortedMessageIds: sortMessages(init.messages),
          setMessages(messages: Record<string, Chat.Message>) {
            set(
              produce((state) => {
                state.messages = messages;
                state.sortedMessageIds = sortMessages(messages);
              })
            );
          },
          setPersistentState(options: { messageId: string; state: any }) {
            set((s) => {
              // TODO: pass the state to server since the state is persistent
              return produce(s, (draft) => {
                draft.persistentStateByMessageId[options.messageId] =
                  options.state;
              });
            });
          },
          async invoke(options: { nodeId: string; input: NewMessage }) {
            set((s) => {
              const message = options.input;
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

            const body = init.middleware?.request?.({
              ...options,
              state: get(),
            }) || {
              nodeId: options.nodeId,
              input: options.input,
            };
            const result = client.start(body);
            result.subscribe({
              next(msg) {
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
                        state.messages[data.id].message!.content =
                          (s.messages[data.id].message?.content || "") +
                          data.message.content;
                      } else {
                        state.messages[data.id] = data;
                      }
                    });
                  } else if (msg.type == "message/ui") {
                    state = produce(s, (state) => {
                      state.messages[options.input.id] = msg.data;
                    });
                  } else if (msg.type == "message/ui/update") {
                    const data = msg.data;
                    state = produce(s, (state) => {
                      state.messages[data.id] = data;
                    });
                  } else {
                    throw new Error(
                      "unknown message type:" + (msg as any).type
                    );
                  }
                  return produce(state, (state: any) => {
                    state.sortedMessageIds = sortMessages(state.messages);
                  });
                });
              },
              error(error) {
                init.onInvokeError?.(error);
              },
            });
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
