import type {
  BaseReagentNodeOptions,
  WorkflowNode,
  StepState,
  WorkflowRunEvent,
} from "@reagentai/reagent/workflow/client";

export type Subscriber = {
  next?(value: any): void;
  error?(error: Response | any): void;
  complete?(): void;
};

type SendResult = {
  subscribe(subscriber: Subscriber): void;
  toPromise(): Promise<void>;
};

export type EmitOptions = {
  session?: { id: string };
  events: WorkflowRunEvent[];
  // updated stated by node id
  states?: Record<string, StepState>;
};

export type ExecutionClient = {
  send(request: EmitOptions): SendResult;
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
    request: (options: EmitOptions) => EmitOptions & Record<string, any>;
  };
};

export type WorkflowClient = {
  start(options: { nodeId: string; input: any }): SendResult;
  send(emitOptions: EmitOptions): SendResult;
};
