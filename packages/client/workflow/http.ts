import { EventType } from "@reagentai/reagent/workflow/client";
import type { Chat } from "@reagentai/reagent/chat";
import { jsonStreamToAsyncIterator } from "@reagentai/reagent/utils";
import { dset } from "dset/merge";

import { executeNode } from "./execution.js";
import type {
  ExecutionRequest,
  ExecutionClient,
  WorkflowClientOptions,
  ExecutionResponse,
  PendingTasks,
} from "./types.js";

export type HttpOptions = {
  url: string;
  headers?: Record<string, string>;
};

const createHttpClient = (
  options: {
    http: HttpOptions;
  } & WorkflowClientOptions
): ExecutionClient => {
  const state = {
    isIdle: true,
  };

  const onPendingTasks = options.middleware?.onPendingTasks;
  const globalSubscribers: ExecutionResponse.Subscriber[] = [];

  function getTemplate(node: { type: string }) {
    const template = options.templates.find((n1: any) => n1.id == node.type);
    if (!template) {
      throw new Error(`Node template not found: ${node.type}`);
    }
    return template;
  }

  async function resumePendingTasks(tasks: PendingTasks) {
    updateStatus({ isIdle: false });

    const { states, pendingExecutions, pendingPrompts } = tasks;

    await Promise.allSettled(
      pendingExecutions.map((execution) => {
        return executeNode(
          {
            send(...args) {
              return send.bind({
                states,
                workflowSubscribers: [...globalSubscribers],
              })(...args);
            },
          },
          {
            ...execution,
            template: getTemplate(execution.node),
          }
        );
      })
    );

    if (pendingPrompts.length > 1) {
      throw new Error(
        "Expected only one prompt but received: " + pendingPrompts.length
      );
    }
    if (pendingPrompts.length > 0 && options.showPrompt) {
      const { session, render, node } = pendingPrompts[0];
      const template = getTemplate(node);
      await new Promise((resolve) => {
        const [_, Component] =
          (template as any).components.find((c: any) => c[0] == render.step) ||
          [];
        if (!Component) {
          throw new Error(`missing prompt component`);
        }

        let submitted = false;
        options.showPrompt!({
          Component,
          props: {
            render: {
              key: render.key,
            },
            data: render.data,
            submit(result) {
              if (submitted) {
                return;
              }
              submitted = true;
              const path = node.path || [];
              path.push(node.id);
              dset(states, path, {
                "@@prompt": {
                  [render.step]: {
                    [render.key]: {
                      result,
                    },
                  },
                },
              });

              const res = send.bind({
                states,
                workflowSubscribers: [...globalSubscribers],
              })({
                session: { id: session.id },
                events: [],
                states,
              });
              res.subscribe({
                complete() {
                  resolve(null);
                },
                error(error) {
                  resolve(null);
                },
              });
            },
          },
        });
      });
    }
    updateStatus({ isIdle: true });
  }

  const updateStatus = (update: { isIdle: boolean }) => {
    state.isIdle = update.isIdle;
    globalSubscribers.forEach((subscriber) =>
      subscriber.onStatusUpdate?.({ idle: state.isIdle })
    );
  };

  const client: ExecutionClient = {
    get isIdle() {
      return state.isIdle;
    },
    send(...args) {
      return send.bind({
        topLevel: true,
        states: undefined,
        workflowSubscribers: [...globalSubscribers],
      })(...args);
    },
    resumePendingTasks,
    subscribe(subscriber) {
      globalSubscribers.push(subscriber);
    },
  };

  function send(request: {
    session?: { id: string };
    events: any[];
    states?: Record<string, any>;
  }) {
    // @ts-expect-error
    const self = this as any;
    const localSubscribers: ExecutionResponse.Subscriber[] = [];
    const workflowSubscribers: ExecutionResponse.Subscriber[] = [
      ...self.workflowSubscribers,
    ];
    const promise = (async () => {
      self.states = self.states || {};
      Object.entries(request.states || {}).forEach(([key, value]) => {
        dset(self.states, [key], value);
      });

      let body: ExecutionRequest = {
        ...request,
        states: self.states,
      };
      if (options.middleware?.request) {
        body = options.middleware.request(body);
      }

      updateStatus({ isIdle: false });
      const { url } = options.http;
      let res: Response;
      try {
        res = await fetch(url, {
          method: "POST",
          body: JSON.stringify(body),
          headers: options.http.headers,
        });
      } catch (e) {
        workflowSubscribers.forEach((subscriber) =>
          subscriber.error?.({
            error: `Error sending request to: ${url}`,
          })
        );
        localSubscribers.forEach((subscriber) =>
          subscriber.error?.({
            error: `Error sending request to: ${url}`,
          })
        );
        return;
      }
      if (res.status != 200) {
        workflowSubscribers.forEach((subscriber) => subscriber.error?.(res));
        localSubscribers.forEach((subscriber) => subscriber.error?.(res));
        return;
      }

      const response = jsonStreamToAsyncIterator<Chat.Response>(res.body!);
      const pendingExecutions = [];
      const pendingPrompts = [];
      const states: any = {
        ...(self.states || {}),
      };
      for await (let { json } of response) {
        json = json!;
        if (json.type == "event") {
          const event = json.data;
          if (
            event.type == EventType.EXECUTE_ON_CLIENT ||
            event.type == EventType.PROMPT
          ) {
            if (event.type == EventType.EXECUTE_ON_CLIENT) {
              pendingExecutions.push({
                node: event.node,
                session: event.session,
                input: event.input,
              });
            } else if (event.type == EventType.PROMPT) {
              pendingPrompts.push(event);
            }
          } else if (event.type == "UPDATE_NODE_STATE") {
            const path = event.node.path || [];
            path.push(event.node.id);
            dset(states, path, event.state);
          }
        } else {
          workflowSubscribers.forEach((subscriber) => subscriber.next?.(json));
          // Note: no need to call next for localSubscribers
        }
      }
      if (pendingExecutions.length == 0 && pendingPrompts.length == 0) {
        if (options.showPrompt) {
          options.showPrompt(undefined);
        }
        workflowSubscribers.forEach((subscriber) => subscriber.complete?.());
      }

      if (!options.autoRunPendingTasks) {
        if (!onPendingTasks) {
          throw new Error(
            "onPendingTasks should be passed if autoRunPendingTasks is false"
          );
        } else {
          onPendingTasks(
            {
              states,
              pendingExecutions,
              pendingPrompts,
            },
            {
              client,
            }
          );
        }
      } else if (onPendingTasks) {
        throw new Error(
          "onPendingTasks can't be passed when autoRunPendingTasks is false"
        );
      } else {
        await resumePendingTasks({
          states,
          pendingExecutions,
          pendingPrompts,
        });
      }

      updateStatus({ isIdle: true });
      localSubscribers.forEach((subscriber) => subscriber.complete?.());
    })();
    promise.catch((e) => {
      // this catch should never be called
      console.error("Unexpected error: ", e);
    });
    return {
      subscribe(subscriber: ExecutionResponse.Subscriber) {
        if (self.topLevel) {
          workflowSubscribers.push(subscriber);
        } else {
          localSubscribers.push(subscriber);
        }
      },
    };
  }

  return client;
};

export { createHttpClient };
