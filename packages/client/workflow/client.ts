import { EventType, BaseReagentNodeOptions } from "@reagentai/reagent/workflow";

import { createHttpClient, HttpOptions } from "./http.js";

type WebsocketOptions = {
  websocket: {
    url: string;
  };
};

type WorkflowClientOptions = {
  nodes: BaseReagentNodeOptions<any, any, any>[];
} & ({ http: HttpOptions } | WebsocketOptions);

const createWorkflowClient = (options: WorkflowClientOptions) => {
  const client = createHttpClient({
    http: (options as any).http,
    nodes: options.nodes,
  });
  return {
    start(options: { nodeId: string; input: any }) {
      const res = client.emit({
        events: [
          {
            type: EventType.INVOKE,
            node: {
              id: options.nodeId,
            },
            input: options.input,
          },
        ],
      });
      return res;
    },
  };
};

export { createWorkflowClient };
