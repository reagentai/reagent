import { EventType, type BaseReagentNodeOptions } from "@reagentai/reagent";
import { jsonStreamToAsyncIterator } from "@reagentai/reagent/utils";

import { executeNode } from "./execution.js";
import type { Subscriber } from "./types.js";

export type HttpOptions = {
  url: string;
  headers?: Record<string, string>;
};

const createHttpClient = (options: {
  http: HttpOptions;
  nodes: BaseReagentNodeOptions<any, any, any>[];
}) => {
  return {
    emit(emitOptions: {
      sessionId?: string;
      events: any[];
      states?: Record<string, any>;
    }) {
      const subscribers: Subscriber[] = [];
      const promise = (async () => {
        const self = this as any;
        self.states = {
          ...(self.states || {}),
          ...(emitOptions.states || {}),
        };

        const res = await fetch(options.http.url, {
          method: "POST",
          body: JSON.stringify({
            sessionId: emitOptions.sessionId,
            events: emitOptions.events,
            states: self.states,
          }),
          headers: options.http.headers,
        });

        if (res.status != 200) {
          subscribers.forEach((subscriber) => subscriber.error?.(res));
          return;
        }

        const response = jsonStreamToAsyncIterator(res.body!);
        const pendingExecutions = [];
        const states: any = {
          ...(self.states || {}),
        };
        for await (const { json } of response) {
          if (json.type == "event") {
            const event = json.data;
            if (event.type == EventType.EXECUTE_ON_CLIENT) {
              const node = options.nodes.find(
                (n1: any) => n1.id == event.node.id
              );
              if (!node) {
                throw new Error(`Node not found: ${event.node.id}`);
              }
              pendingExecutions.push({
                node,
                session: event.session,
                input: event.input,
              });
            } else if (event.type == "UPDATE_NODE_STATE") {
              states[event.node.id] = event.state;
            }
          } else {
            subscribers.forEach((subscriber) => subscriber.next?.(json));
          }
        }
        await Promise.all(
          pendingExecutions.map((execution) => {
            return executeNode(
              {
                emit: self.emit.bind({ emit: self.emit, states }),
              },
              {
                session: execution.session,
                node: execution.node,
                input: execution.input,
              }
            );
          })
        );
      })();
      return {
        subscribe(subscriber: Subscriber) {
          subscribers.push(subscriber);
        },
        toPromise() {
          return promise;
        },
      };
    },
  };
};

export { createHttpClient };
