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
    http: (options as any).http,
    templates: options.templates,
    showPrompt: options.showPrompt,
    middleware: options.middleware,
  });
  return {
    start({ nodeId, input }) {
      const res = client.send({
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
      return res;
    },
    send(options) {
      return client.send(options);
    },
  };
};

export { createWorkflowClient };
