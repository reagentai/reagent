import type { StepState, WorkflowRunEvent } from "@reagentai/reagent";

export type Subscriber = {
  next?(value: any): void;
  error?(error: Response | any): void;
};

export type WorkflowClient = {
  emit(emitOptions: {
    sessionId?: string;
    events: WorkflowRunEvent[];
    // updated stated by node id
    states?: Record<string, StepState>;
  }): {
    subscribe(subscriber: Subscriber): void;
    toPromise(): Promise<void>;
  };
};
