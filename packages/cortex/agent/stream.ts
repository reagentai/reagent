import { ReplaySubject } from "rxjs";

namespace AgentEvent {
  export enum Type {
    Output = "output",
    Render = "render",
  }

  export type Output<O> = {
    type: Type.Output;
    run: {
      id: string;
    };
    node: {
      id: string;
      type: string;
      version: string;
    };
    output: O;
  };

  export type RenderUpdate<State> = {
    type: Type.Render;
    run: {
      id: string;
    };
    node: {
      id: string;
      type: string;
      version: string;
    };
    render: {
      step: string;
      data: State;
    };
  };
}

type AgentEvent<Output, State> =
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
