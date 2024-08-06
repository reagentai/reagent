export namespace Chat {
  type AgentNode = {
    id: string;
    type: string;
    version: string;
  };

  export type UIRenderData = {
    step: string;
    data: any;
  };

  export type Message = {
    id: string;
    node?: AgentNode;
    message?: {
      content: string;
    };
    ui?: UIRenderData;
    role: string;
    createdAt: string;
  };

  namespace StreamResponse {
    export type Message = {
      type: "message/content";
      data: {
        // message id
        id: string;
        node: AgentNode;
        message: {
          content: string;
        };
        role: string;
        createdAt: string;
      };
    };

    export type ContentDelta = {
      type: "message/content/delta";
      data: {
        // message id
        id: string;
        node: AgentNode;
        message: {
          content: string;
        };
        role: string;
        createdAt: string;
      };
    };

    export type ToolUI = {
      type: "message/ui";
      data: {
        // message id
        id: string;
        node: AgentNode;
        ui: UIRenderData;
        role: string;
        createdAt: string;
      };
    };

    export type ToolUIUpdate = {
      type: "message/ui/update";
      data: {
        // message id
        id: string;
        node: AgentNode;
        ui: UIRenderData;
        role: string;
        createdAt: string;
      };
    };

    type ExecuteOnClient = {
      type: "EXECUTE_ON_CLIENT";
      session: {
        id: string;
      };
      node: {
        id: string;
      };
      input: any;
    };
    type UpdateNodeState = {
      type: "UPDATE_NODE_STATE";
      node: {
        id: string;
      };
      state: any;
    };
    export type WorkflowEvent = {
      type: "event";
      data: ExecuteOnClient | UpdateNodeState;
    };
  }

  export type Response =
    | StreamResponse.Message
    | StreamResponse.ContentDelta
    | StreamResponse.ToolUI
    | StreamResponse.ToolUIUpdate
    | StreamResponse.WorkflowEvent;
  export type ResponseStream = AsyncIterable<Response>;
}
