import type {
  BaseReagentNodeOptions,
  WorkflowNode,
  StepState,
  WorkflowRunEvent,
  Context,
} from "@reagentai/reagent/workflow/client";

export namespace ExecutionResponse {
  export type Error = Response | { error?: string };

  export type Subscriber = {
    onStatusUpdate?(status: { idle: boolean }): void;
    next?(value: any): void;
    error?(error: Error): void;
    complete?(): void;
  };
}

type ExecutionResponse = {
  subscribe(subscriber: ExecutionResponse.Subscriber): void;
};

export type ExecutionRequest = {
  session?: { id: string };
  events: WorkflowRunEvent[];
  // updated stated by node id
  states?: Record<string, StepState>;
};

export type ExecutionClient = {
  isIdle: boolean;
  send(request: ExecutionRequest): void;
  resumePendingTasks(tasks: PendingTasks): Promise<void>;
  subscribe(subscriber: ExecutionResponse.Subscriber): void;
};

export type PendingTasks = {
  states: any;
  pendingExecutions: any[];
  pendingPrompts: any[];
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
          props: Pick<
            Context.PromptProps<any, any>,
            "render" | "data" | "submit"
          >;
        }
      | undefined
  ) => void;
  // defaults to true
  autoRunPendingTasks?: boolean;
  middleware?: {
    onPendingTasks?: (
      tasks: PendingTasks,
      options: { client: ExecutionClient }
    ) => void;
    request?: (
      options: ExecutionRequest
    ) => ExecutionRequest & Record<string, any>;
  };
};

export type WorkflowClient = {
  isIdle: boolean;
  start(options: { nodeId: string; input: any }): void;
  send(emitOptions: ExecutionRequest): void;
  resumePendingTasks(tasks: PendingTasks): void;
  subscribe(subscriber: ExecutionResponse.Subscriber): void;
};
