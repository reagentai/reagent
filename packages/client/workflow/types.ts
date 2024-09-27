import type {
  BaseReagentNodeOptions,
  WorkflowNode,
  StepState,
  WorkflowRunEvent,
} from "@reagentai/reagent/workflow/client";

export namespace ExecutionResponse {
  export type Error = Response | { error?: string };

  export type Subscriber = {
    next?(value: any): void;
    error?(error: Error): void;
    complete?(): void;
  };
}

type ExecutionResponse = {
  subscribe(subscriber: ExecutionResponse.Subscriber): void;
  toPromise(): Promise<void>;
};

export type ExecutionRequest = {
  session?: { id: string };
  events: WorkflowRunEvent[];
  // updated stated by node id
  states?: Record<string, StepState>;
};

export type ExecutionClient = {
  send(request: ExecutionRequest): ExecutionResponse;
};

export type WorkflowClientOptions = {
  templates:
    | BaseReagentNodeOptions<any, any, any>[]
    | WorkflowNode<any, any, any>[];
  // showPrompt(...) is called with `undefined` to clear
  // the prompt after a prompt is shown
  showPrompt?: (
    prompt:
      | {
          Component: any;
          props: { key: string; data: any; submit: (value: any) => void };
        }
      | undefined
  ) => void;
  middleware?: {
    request: (
      options: ExecutionRequest
    ) => ExecutionRequest & Record<string, any>;
  };
};

export type WorkflowClient = {
  start(options: { nodeId: string; input: any }): ExecutionResponse;
  send(emitOptions: ExecutionRequest): ExecutionResponse;
};
