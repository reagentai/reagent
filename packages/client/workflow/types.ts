import type {
  BaseReagentNodeOptions,
  StepState,
  WorkflowRunEvent,
} from "@reagentai/reagent";

export type Subscriber = {
  next?(value: any): void;
  error?(error: Response | any): void;
};

type EmitResult = {
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
  emit(emitOptions: EmitOptions): EmitResult;
};

export type WorkflowClientOptions = {
  templates: BaseReagentNodeOptions<any, any, any>[];
  // showPrompt(...) is called with `undefined` to clear
  // the prompt after a prompt is shown
  showPrompt?: (
    options:
      | {
          Component: any;
          props: { data: any; submit: (value: any) => void };
        }
      | undefined
  ) => void;
};

export type WorkflowClient = {
  start(options: { nodeId: string; input: any }): EmitResult;
  emit(emitOptions: EmitOptions): EmitResult;
};
