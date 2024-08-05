import { EventType, type BaseReagentNodeOptions } from "@reagentai/reagent";
import { jsonStreamToAsyncIterator } from "@reagentai/reagent/utils";

import { executeNode } from "./execution.js";

const createHttpClient = (options: {
  url: string;
  nodes: BaseReagentNodeOptions<any, any, any>[];
}) => {
  return {
    // even though "states" is bound to emit function,
    // setting it here will shut up TS compiler
    states: undefined as any,
    async emit(emitOptions: {
      sessionId?: string;
      events: any[];
      states?: Record<string, any>;
    }) {
      const self = this;
      self.states = {
        ...(self.states || {}),
        ...(emitOptions.states || {}),
      };
      const res = await fetch(options.url, {
        method: "POST",
        body: JSON.stringify({
          sessionId: emitOptions.sessionId,
          events: emitOptions.events,
          states: self.states,
        }),
      });

      const response = jsonStreamToAsyncIterator(res.body!);
      const subscribers: any[] = [];
      const pendingExecutions = [];
      const states: any = {
        ...(self.states || {}),
      };
      const promise = (async () => {
        for await (const { json } of response) {
          subscribers.forEach((subscriber) => subscriber(json));
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
        subscribe(cb: (value: any) => void) {
          subscribers.push(cb);
        },
        toPromise() {
          return promise;
        },
      };
    },
  };
};

export { createHttpClient };
