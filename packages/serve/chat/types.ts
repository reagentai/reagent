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
    // message group id
    // this can be used to render all messages in a group
    // under
    // are render
    // groupId: string;
    node?: AgentNode;
    message: {
      content?: string;
      // type id of the tool that renders the UI
      ui?: UIRenderData;
    };
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

    export type Tool = {
      type: "message/ui";
      data: {
        // message id
        id: string;
        node: AgentNode;
        message: {
          ui: UIRenderData;
        };
        role: string;
        createdAt: string;
      };
    };

    export type ToolUpdate = {
      type: "message/ui/update";
      data: {
        // message id
        id: string;
        node: AgentNode;
        message: {
          ui: UIRenderData;
        };
        role: string;
        createdAt: string;
      };
    };
  }

  export type Response =
    | StreamResponse.Message
    | StreamResponse.ContentDelta
    | StreamResponse.Tool
    | StreamResponse.ToolUpdate;
  export type ResponseStream = AsyncIterable<Response>;
}
