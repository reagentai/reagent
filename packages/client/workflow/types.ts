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

export type ExecutionRequest<Input = any> = {
  session?: { id: string };
  input?: Input;
  events: WorkflowRunEvent[];
  // updated stated by node id
  states?: Record<string, StepState>;
};

export type ExecutionClient = {
  isIdle: boolean;
  send(request: ExecutionRequest): ExecutionResponse;
  resumePendingTasks(tasks: PendingTasks): Promise<void>;
  subscribe(subscriber: ExecutionResponse.Subscriber): void;
};

export type PendingTasks = {
  // workflow input
  input?: any;
  states: any;
  pendingExecutions: any[];
  pendingPrompts: {
    session: {
      id: string;
    };
    node: {
      id: string;
      path?: string[];
      type: string;
    };
    render: Pick<
      Context.PromptProps<any, any>,
      "data" | "requiresUserInput"
    > & {
      step: string;
      key: string;
    };
  }[];
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
            "render" | "data" | "submit" | "requiresUserInput"
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
  start(
    event: { node: { id: string }; input: any },
    options?: {
      // workflow input
      input?: any;
    }
  ): void;
  send(emitOptions: ExecutionRequest): void;
  resumePendingTasks(tasks: PendingTasks): void;
  subscribe(subscriber: ExecutionResponse.Subscriber): void;
};
