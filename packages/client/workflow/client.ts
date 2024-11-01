import { EventType } from "@reagentai/reagent/workflow/client";

import { createHttpClient, HttpOptions } from "./http.js";
import { WorkflowClient, WorkflowClientOptions } from "./types.js";

type WebsocketOptions = {
  websocket: {
    url: string;
  };
};

const createWorkflowClient = (
  options: WorkflowClientOptions & ({ http: HttpOptions } | WebsocketOptions)
): WorkflowClient => {
  const client = createHttpClient({
    // set autoRunPendingTasks to true if not set
    autoRunPendingTasks: options.autoRunPendingTasks !== false,
    http: (options as any).http,
    templates: options.templates,
    showPrompt: options.showPrompt,
    middleware: options.middleware,
  });
  return {
    get isIdle() {
      return client.isIdle;
    },
    start({ nodeId, input }) {
      client.send({
        events: [
          {
            type: EventType.INVOKE,
            node: {
              id: nodeId,
            },
            input,
          },
        ],
      });
    },
    send(options) {
      client.send(options);
    },
    resumePendingTasks(tasks) {
      client.resumePendingTasks(tasks);
    },
    subscribe: client.subscribe,
  };
};

export { createWorkflowClient };
