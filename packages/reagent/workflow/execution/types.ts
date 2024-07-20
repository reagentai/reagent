import { OutputValueProvider, ValueProvider } from "./WorkflowStepOutput";
import { ZodObjectSchema } from "../core/zod";

export type Session = {
  id: string;
};

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
};

export type RenderUpdate = {
  node: { id: string; type: string; version: string };
  render: {
    step: string;
    data: any;
  };
};
