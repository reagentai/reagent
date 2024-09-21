import {
  EventType,
  type BaseReagentNodeOptions,
} from "@reagentai/reagent/workflow/client";
import type { Chat } from "@reagentai/reagent/chat";
import { jsonStreamToAsyncIterator } from "@reagentai/reagent/utils";
import { dset } from "dset/merge";

import { executeNode } from "./execution.js";
import type {
  ExecutionClient,
  Subscriber,
  WorkflowClientOptions,
} from "./types.js";

export type HttpOptions = {
  url: string;
  headers?: Record<string, string>;
};

const createHttpClient = (
  options: {
    http: HttpOptions;
    templates: BaseReagentNodeOptions<any, any, any>[];
  } & Pick<WorkflowClientOptions, "showPrompt">
): ExecutionClient => {
  function send(request: {
    session?: { id: string };
    events: any[];
    states?: Record<string, any>;
  }) {
    // @ts-expect-error
    const self = this as any;
    const subscribers: Subscriber[] = [...self.subscribers];
    const promise = (async () => {
      self.states = self.states || {};
      Object.entries(request.states || {}).forEach(([key, value]) => {
        dset(self.states, [key], value);
      });

      const res = await fetch(options.http.url, {
        method: "POST",
        body: JSON.stringify({
          ...request,
          states: self.states,
        }),
        headers: options.http.headers,
      });

      if (res.status != 200) {
        subscribers.forEach((subscriber) => subscriber.error?.(res));
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
            const template = options.templates.find(
              (n1: any) => n1.id == event.node.type
            );
            if (!template) {
              throw new Error(`Node template not found: ${event.node.type}`);
            }

            if (event.type == EventType.EXECUTE_ON_CLIENT) {
              pendingExecutions.push({
                node: event.node,
                session: event.session,
                template,
                input: event.input,
              });
            } else if (event.type == EventType.PROMPT) {
              pendingPrompts.push({
                ...event,
                template,
              });
            }
          } else if (event.type == "UPDATE_NODE_STATE") {
            const path = event.node.path || [];
            path.push(event.node.id);
            dset(states, path, event.state);
          }
        } else {
          subscribers.forEach((subscriber) => subscriber.next?.(json));
        }
      }
      await Promise.all(
        pendingExecutions.map((execution) => {
          return executeNode(
            {
              send(...args) {
                return send.bind({
                  states,
                  subscribers,
                })(...args);
              },
            },
            execution
          );
        })
      );
      if (pendingPrompts.length > 0 && options.showPrompt) {
        await Promise.all(
          pendingPrompts.map(({ template, render, node }) => {
            const [_, Component] =
              (template as any).components.find(
                (c: any) => c[0] == render.step
              ) || [];
            if (!Component) {
              throw new Error(`missing prompt component`);
            }

            let resolve: any;
            const pending = new Promise((r) => (resolve = r));
            options.showPrompt!({
              Component,
              props: {
                data: render.data,
                submit(result) {
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

                  send.bind({ states, subscribers })({
                    events: [],
                    states,
                  });
                  resolve();
                },
              },
            });
            return pending;
          })
        );
        options.showPrompt(undefined);
      }
      subscribers.forEach((subscriber) => subscriber.complete?.());
    })();
    return {
      subscribe(subscriber: Subscriber) {
        subscribers.push(subscriber);
      },
      toPromise() {
        return promise;
      },
    };
  }

  return {
    send(...args) {
      return send.bind({
        states: undefined,
        subscribers: [],
      })(...args);
    },
  };
};

export { createHttpClient };
