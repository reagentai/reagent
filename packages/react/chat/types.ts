export namespace Chat {
  type UI = {
    node: {
      id: string;
      type: string;
      version: string;
    };
    render: {
      step: string;
      data: any;
    };
  };

  export type Message = {
    id: string;
    // message group id
    // this can be used to render all messages in a group
    // under
    // are render
    // groupId: string;
    message: {
      content?: string;
      // type id of the tool that renders the UI
      ui?: UI;
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
        message: {
          content: {
            delta: string;
          };
        };
      };
    };

    export type Tool = {
      type: "message/ui";
      data: {
        // message id
        id: string;
        message: {
          ui: UI;
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
        message: {
          ui: UI;
        };
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
