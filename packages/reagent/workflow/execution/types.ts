import { OutputValueProvider, ValueProvider } from "./WorkflowStepOutput.js";
import { ZodObjectSchema } from "../core/zod.js";
import { Lazy } from "./operators/index.js";

export enum StepStatus {
  INVOKED = "INVOKED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum EventType {
  // emitted when a workflow is started
  START = "START",
  INVOKE = "INVOKE",
  NO_BINDINGS = "NO_BINDINGS",
  SKIP_INVOKE = "SKIP_INVOKE",
  SKIP_RUN = "SKIP_RUN",
  TOOL_CALL = "TOOL_CALL",
  OUTPUT = "OUTPUT",
  RENDER = "RENDER",
  EXECUTE_ON_CLIENT = "EXECUTE_ON_CLIENT",
  RUN_COMPLETED = "RUN_COMPLETED",
  RUN_CANCELLED = "RUN_CANCELLED",
  RUN_FAILED = "RUN_FAILED",
}

export enum ClientEventType {
  INVOKE = EventType.INVOKE,
  OUTPUT = EventType.OUTPUT,
  EXECUTE_ON_CLIENT = EventType.EXECUTE_ON_CLIENT,
  RUN_COMPLETED = EventType.RUN_COMPLETED,
  RUN_CANCELLED = EventType.RUN_CANCELLED,
  RUN_FAILED = EventType.RUN_FAILED,
}

export type NodeMetadata = {
  // node id
  id: string;
  type: string;
  version: string;
};

export type NodeDependency = {
  id: string;
  type: string;
  version: string;
  field: string;
};

export type Session = {
  id: string;
};

namespace WorkflowEvent {
  export type Invoke = {
    type: ClientEventType.INVOKE;
    session: {
      id: string;
    };
    node: Pick<NodeMetadata, "id">;
    input: any;
  };

  export type Output = {
    type: ClientEventType.OUTPUT;
    session: {
      id: string;
    };
    node: Pick<NodeMetadata, "id">;
    output: any;
  };

  export type RunCompleted = {
    type: ClientEventType.RUN_COMPLETED;
    session: {
      id: string;
    };
    node: Pick<NodeMetadata, "id">;
  };
}

export type { WorkflowEvent };

export type StepState =
  | {
      status: StepStatus.INVOKED;
      input: Record<string, any>;
    }
  | {
      status: StepStatus.COMPLETED;
      output: Record<string, any>;
    }
  | {
      status: StepStatus.FAILED;
      // output of serialize-error
      error: any;
    };

export type WorkflowRunEvent =
  | Omit<WorkflowEvent.Output, "session">
  | Omit<WorkflowEvent.Invoke, "session">
  | Omit<WorkflowEvent.RunCompleted, "session">;

export type WorkflowRunOptions = {
  sessionId?: string;
  getStepState?: (
    nodeId: string
  ) => StepState | void | Promise<StepState | undefined | void>;
  updateStepState?: (
    node: NodeMetadata,
    state: Partial<StepState>
  ) => void | Promise<void>;
  events: WorkflowRunEvent[];
};

// LLM tool
export type Tool<Params, Result> = {
  name: string;
  description: string;
  parameters: ZodObjectSchema<Params>;
  execute: (parameters: Params) => Promise<Result>;
};

type ValueOrProvider<Value> =
  | OutputValueProvider<Value>
  | ValueProvider<Value>
  | Lazy<Value>
  | Value;

export type EdgeBindings<Input> = {
  [K in keyof Input]: Required<Input>[K] extends any[]
    ?
        | Required<Input>[K]
        | ValueProvider<Required<Input>[K][]>
        | ValueOrProvider<Required<Input>[K][number]>[]
    : Input[K] extends ValueProvider<Input[K]>
      ? ValueProvider<Input[K]>
      : ValueOrProvider<Required<Input>[K]>;
};

export type WorkflowOutputBindings = {
  markdown?: ValueProvider<any>[];
  markdownStream?: ValueProvider<any>[];
  ui?: ValueProvider<RenderUpdate>[];
  data?: ValueProvider<any>;
};

export type RenderUpdate = {
  node: { id: string; type: string; version: string };
  render: {
    step: string;
    data: any;
  };
};
