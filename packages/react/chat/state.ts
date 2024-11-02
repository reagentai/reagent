import { createStore } from "zustand/vanilla";
import { persist } from "zustand/middleware";
import { produce, WritableDraft } from "immer";
import { includeKeys } from "filter-obj";
import {
  createWorkflowClient,
  EventType,
  type WorkflowClientOptions,
  type ExecutionRequest,
  type ExecutionResponse,
  WorkflowClient,
} from "@reagentai/client/workflow";
import type { Chat } from "@reagentai/reagent/chat";
import type {
  BaseReagentNodeOptions,
  WorkflowNode,
  WorkflowRunEvent,
} from "@reagentai/reagent";

export type NewMessage = {
  id: string;
  query: string;
  regenerate: boolean;
};

export type ChatState = {
  client: WorkflowClient;
  messages: Record<string, Chat.Message>;
  sortedMessageIds: string[];
  prompt: Parameters<Required<WorkflowClientOptions>["showPrompt"]>[0];
  inflightRequest: {
    responseReceived: boolean;
  } | null;
  error?: string;
  resetError(): void;
  setMessages: (messages: Record<string, Chat.Message>) => void;
  invoke: (options: { nodeId: string; input: NewMessage }) => Promise<void>;
  reset(): Promise<void>;
};

type StoreInit = {
  messages: Record<string, Chat.Message>;
  // workflow execution url
  url: string;
  templates:
    | BaseReagentNodeOptions<any, any, any>[]
    // during build, WorkflowNode will be converted to BaseReagentNodeOptions
    // for client bundle, using `WorkflowNode` here only for type safety
    | WorkflowNode<any, any, any>[];
  autoRunPendingTasks?: boolean;
  middleware?: {
    onPendingTasks?: Required<WorkflowClientOptions>["middleware"]["onPendingTasks"];
    request?: (
      options: ExecutionRequest,
      state: ChatState
    ) => ExecutionRequest & Record<string, any>;
    response?: {
      error?: (
        error: ExecutionResponse.Error
      ) => Promise<string | undefined> | string | undefined;
    };
  };
};

export const createChatStore = (
  init: StoreInit,
  options?: {
    client?: {
      headers?: Record<string, string>;
    };
    persistKey?: string;
  }
) => {
  const withPerisist: typeof persist = options?.persistKey
    ? persist
    : (x: any) => {
        return x;
      };

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

  return createStore(
    withPerisist<ChatState>(
      (set, get, store) => {
        const setProduce = (
          producer: (state: WritableDraft<ChatState>) => void
        ) => {
          set(produce(producer));
        };

        const client = createWorkflowClient({
          autoRunPendingTasks: init.autoRunPendingTasks,
          http: {
            url: init.url,
            headers: {
              "content-type": "application/json",
              ...(options?.client?.headers || {}),
            },
          },
          templates: init.templates as BaseReagentNodeOptions<any, any, any>[],
          showPrompt(prompt) {
            setProduce((state) => {
              state.prompt = prompt;
            });
          },
          middleware: {
            onPendingTasks: init.middleware?.onPendingTasks,
            request(req) {
              return init.middleware?.request?.(req, get()) || req;
            },
          },
        });

        client.subscribe({
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
                const data = msg.data;
                state = produce(s, (state) => {
                  state.messages[data.id] = msg.data;
                });
              } else if (msg.type == "message/ui/update") {
                const data = msg.data;
                state = produce(s, (state) => {
                  const prev = s.messages[data.id]?.ui || [];
                  state.messages[data.id] = {
                    ...data,
                    ui: Array.from(
                      // unique items by render key
                      new Map(
                        [...prev, data.ui].map((ui) => [ui["key"], ui])
                      ).values()
                    ),
                  };
                });
              } else {
                throw new Error("unknown message type:" + (msg as any).type);
              }
              return produce(state, (state) => {
                state.inflightRequest = { responseReceived: true };
                state.sortedMessageIds = sortMessages(state.messages);
              });
            });
          },
          async error(error) {
            const err = await init.middleware?.response?.error?.(error);
            setProduce((state) => {
              state.inflightRequest = null;
              state.error = err;
            });
          },
          complete() {
            setProduce((state) => {
              state.inflightRequest = null;
            });
          },
        });

        return {
          client,
          messages: init.messages,
          sortedMessageIds: sortMessages(init.messages),
          prompt: undefined,
          inflightRequest: null,
          resetError() {
            setProduce((state) => {
              state.error = undefined;
            });
          },
          setMessages(messages: Record<string, Chat.Message>) {
            setProduce((state) => {
              state.messages = messages;
              state.sortedMessageIds = sortMessages(messages);
            });
          },
          async invoke(options: { nodeId: string; input: NewMessage }) {
            set((s) => {
              const message = options.input;
              const state = produce(s, (state) => {
                state.error = undefined;
                state.messages[message.id] = {
                  id: message.id,
                  message: { content: message.query },
                  role: "user",
                  createdAt: new Date().toISOString(),
                };
                state.inflightRequest = {
                  responseReceived: false,
                };
              });

              return produce(state, (state) => {
                state.sortedMessageIds = sortMessages(state.messages);
              });
            });
            client.send({
              events: [
                {
                  type: EventType.INVOKE,
                  input: options.input,
                  node: { id: options.nodeId },
                },
              ] as WorkflowRunEvent[],
            });
          },
          async reset() {
            store.persist.clearStorage();
            set({
              messages: {},
              sortedMessageIds: [],
              prompt: undefined,
              error: undefined,
            });
            await store.persist.rehydrate();
          },
        };
      },
      {
        name: options?.persistKey!,
        // @ts-expect-error
        partialize(state) {
          return includeKeys(state, ["messages", "sortedMessageIds"]);
        },
        merge(persistedState, currentState) {
          return {
            ...currentState,
            ...(persistedState as any),
            sortedMessageIds: sortMessages((persistedState as any).messages),
          };
        },
      }
    )
  );
};

export type ChatStore = ReturnType<typeof createChatStore>;
