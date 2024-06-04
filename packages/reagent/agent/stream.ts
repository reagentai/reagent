import { ReplaySubject } from "rxjs";

enum AgentEventType {
  RunInvoked = "run/invoked",
  // This is trigged when all the node inputs aren't received
  // but the nodes that provide the input values are already executed
  RunSkipped = "run/skipped",
  RunCompleted = "run/complete",
  Output = "output",
  Render = "render",
}

namespace AgentEvent {
  type Session = {
    id: string;
  };

  export type EventNode = {
    id: string;
    type: string;
    version: string;
  };

  export type RunInvoked = {
    type: AgentEventType.RunInvoked;
    session: Session;
    // node invoked
    node: EventNode;
  };

  export type RunCompleted = {
    type: AgentEventType.RunCompleted;
    session: Session;
    node: EventNode;
  };

  export type RunSkipped = {
    type: AgentEventType.RunSkipped;
    session: Session;
    node: EventNode;
  };

  export type Output<O> = {
    type: AgentEventType.Output;
    session: Session;
    node: EventNode;
    output: O;
  };

  export type RenderUpdate<State> = {
    type: AgentEventType.Render;
    session: Session;
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
  | AgentEvent.Output<Output>
  | AgentEvent.RenderUpdate<State>;

class EventStream<Output, State = any> extends ReplaySubject<
  AgentEvent<Output, State>
> {
  constructor(config: { buffer?: number } = {}) {
    // TODO: pass in custom _timestampProvider such that the timestamp is
    // same for all events of a given session. This way it can guaranteed that
    // either all events of a session is bufferred or none at all
    super(config.buffer);
  }

  sendOutput(options: {
    session: {
      id: string;
    };
    node: { id: string; type: string; version: string };
    output: Output;
  }) {
    this.next({
      type: AgentEventType.Output,
      session: {
        id: options.session.id,
      },
      node: options.node,
      output: options.output,
    });
  }

  sendRenderUpdate(options: {
    session: {
      id: string;
    };
    node: { id: string; type: string; version: string };
    update: { step: string; data: any };
  }) {
    this.next({
      type: AgentEventType.Render,
      session: {
        id: options.session.id,
      },
      node: options.node,
      render: {
        step: options.update.step,
        data: options.update.data,
      },
    });
  }
}

export { EventStream, AgentEventType };
export type { AgentEvent };
