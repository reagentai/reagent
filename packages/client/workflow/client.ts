import { EventType, BaseReagentNodeOptions } from "@reagentai/reagent/workflow";

import { createHttpClient } from "./http.js";

type HttpOptions = {
  http: {
    url: string;
  };
};

type WebsocketOptions = {
  websocket: {
    url: string;
  };
};
type WorkflowClientOptions = {
  nodes: BaseReagentNodeOptions<any, any, any>[];
} & (HttpOptions | WebsocketOptions);

const createWorkflowClient = (options: WorkflowClientOptions) => {
  const client = createHttpClient({
    url: (options as HttpOptions).http.url,
    nodes: options.nodes,
  });
  return {
    async start(options: { nodeId: string; input: any }) {
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
