import type { StepState, WorkflowRunEvent } from "@reagentai/reagent";

export type WorkflowClient = {
  emit(emitOptions: {
    sessionId?: string;
    events: WorkflowRunEvent[];
    // updated stated by node id
    states?: Record<string, StepState>;
  }): Promise<{
    subscribe(cb: (value: any) => void): void;
    toPromise(): Promise<void>;
  }>;
};
