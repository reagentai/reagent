import { OutputValueProvider, ValueProvider } from "./WorkflowStepOutput.js";
import { ZodObjectSchema } from "../core/zod.js";
import { Lazy } from "./operators/index.js";

export enum StepStatus {
  INVOKED = "INVOKED",
  STOPPED = "STOPPED",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum WorkflowStatus {
  NOT_STARTED = "NOT_STARTED",
  IN_PROGRESS = "IN_PROGRESS",
  // status is stopped if the workflow isn't completed yet
  // but the current run was finished
  STOPPED = "STOPPED",
  ERRORED = "ERRORED",
  COMPLETED = "COMPLETED",
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
  PROMPT = "PROMPT",
  UPDATE_STATE = "UPDATE_STATE",
  EXECUTE_ON_CLIENT = "EXECUTE_ON_CLIENT",
  RUN_COMPLETED = "RUN_COMPLETED",
  RUN_PAUSED = "RUN_PAUSED",
  RUN_CANCELLED = "RUN_CANCELLED",
  RUN_FAILED = "RUN_FAILED",
  // "SUB_" prefix is used for events that sub-workflows can emit
  SUB_RENDER = "SUB_RENDER",
}

export enum PublicEventType {
  INVOKE = EventType.INVOKE,
  OUTPUT = EventType.OUTPUT,
  PROMPT = EventType.PROMPT,
  EXECUTE_ON_CLIENT = EventType.EXECUTE_ON_CLIENT,
  RUN_COMPLETED = EventType.RUN_COMPLETED,
  RUN_CANCELLED = EventType.RUN_CANCELLED,
  RUN_FAILED = EventType.RUN_FAILED,
  // "SUB_" prefix is used for events that sub-workflows can emit
  SUB_RENDER = EventType.SUB_RENDER,
}

export type NodeMetadata = {
  // node id
  id: string;
  path?: string[];
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
    type: PublicEventType.INVOKE;
    session: {
      id: string;
    };
    node: Pick<NodeMetadata, "id">;
    input: any;
  };

  export type Output = {
    type: PublicEventType.OUTPUT;
    session: {
      id: string;
    };
    node: Pick<NodeMetadata, "id">;
    output: any;
  };

  export type RunCompleted = {
    type: PublicEventType.RUN_COMPLETED;
    session: {
      id: string;
    };
    node: Pick<NodeMetadata, "id">;
  };
}

export type { WorkflowEvent };

// Note: using `@@` prefix for state fields so that
// sub workflow's state can be stored using the node id
// without field name collision
export type StepState = (
  | {
      "@@status": StepStatus.INVOKED;
      "@@data": {
        input: Record<string, any>;
      };
    }
  | {
      "@@status": StepStatus.COMPLETED;
      "@@data": {
        output: Record<string, any>;
      };
    }
  | {
      "@@status": StepStatus.FAILED;
      // output of serialize-error
      "@@data": {
        error: any;
      };
    }
  | {
      "@@status": StepStatus.STOPPED;
      "@@data": {
        input: any;
      };
      // prompt result by prompt id
      "@@prompt": Record<string, { result: any }>;
      // step result by stepId
      "@@steps": Record<string, { result: any }>;
    }
) &
  // for sub-workflow states
  Record<string, any>;

export type WorkflowRunEvent =
  | Omit<WorkflowEvent.Invoke, "session">
  | Omit<WorkflowEvent.Output, "session">
  | Omit<WorkflowEvent.RunCompleted, "session">;

export type WorkflowRunOptions = {
  sessionId?: string;
  getStepState?: (
    nodeId: string
  ) => StepState | void | Promise<StepState | undefined | void>;
  updateStepState?: (
    node: NodeMetadata,
    state: StepState
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
        | ValueProvider<Required<Input>[K]>
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
