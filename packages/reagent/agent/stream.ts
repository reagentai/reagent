import { ReplaySubject } from "rxjs";

namespace AgentEvent {
  export enum Type {
    RunInvoked = "run/invoked",
    // This is trigged when all the node inputs aren't received
    // but the nodes that provide the input values are already executed
    RunSkipped = "run/skipped",
    RunCompleted = "run/complete",
    NodeSchema = "node/schema",
    Output = "output",
    Render = "render",
  }

  type Run = {
    id: string;
  };
  type EventNode = {
    id: string;
    type: string;
    version: string;
  };

  export type RunInvoked = {
    type: Type.RunInvoked;
    run: Run;
    // node invoked
    node: EventNode;
  };

  export type RunCompleted = {
    type: Type.RunCompleted;
    run: Run;
    node: EventNode;
  };

  export type RunSkipped = {
    type: Type.RunSkipped;
    run: Run;
    node: EventNode;
  };

  export type NodeSchema = {
    type: Type.NodeSchema;
    run: Run;
    node: EventNode;
    schema: any;
  };

  export type Output<O> = {
    type: Type.Output;
    run: Run;
    node: EventNode;
    output: O;
  };

  export type RenderUpdate<State> = {
    type: Type.Render;
    run: Run;
    node: EventNode;
    render: {
      step: string;
      data: State;
    };
  };
}

type AgentEvent<Output, State> =
  | AgentEvent.RunInvoked
  | AgentEvent.RunSkipped
  | AgentEvent.RunCompleted
  | AgentEvent.NodeSchema
  | AgentEvent.Output<Output>
  | AgentEvent.RenderUpdate<State>;

class EventStream<Output, State = any> extends ReplaySubject<
  AgentEvent<Output, State>
> {
  constructor(config: { buffer?: number } = {}) {
    // TODO: pass in custom _timestampProvider such that the timestamp is
    // same for all events of a given run. This way it can guaranteed that
    // either all events of a run is bufferred or none at all
    super(config.buffer);
  }

  sendOutput(options: {
    run: {
      id: string;
    };
    node: { id: string; type: string; version: string };
    output: Output;
  }) {
    this.next({
      type: AgentEvent.Type.Output,
      run: {
        id: options.run.id,
      },
      node: options.node,
      output: options.output,
    });
  }

  sendRenderUpdate(options: {
    run: {
      id: string;
    };
    node: { id: string; type: string; version: string };
    update: { step: string; data: any };
  }) {
    this.next({
      type: AgentEvent.Type.Render,
      run: {
        id: options.run.id,
      },
      node: options.node,
      render: {
        step: options.update.step,
        data: options.update.data,
      },
    });
  }
}

export { EventStream };
export { AgentEvent };
