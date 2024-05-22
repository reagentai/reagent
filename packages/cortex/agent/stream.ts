import { ReplaySubject } from "rxjs";

type EventStreamConfig = {
  run: {
    id: string;
  };
};

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
  #config: EventStreamConfig;
  #inner: ReplaySubject<any>;
  constructor(config: EventStreamConfig) {
    super();
    this.#config = config;
    this.#inner = new ReplaySubject();
    this.#inner.next({
      type: "init",
      ...config,
    });
  }

  sendOutput(
    node: { id: string; type: string; version: string },
    output: Output
  ) {
    const { run } = this.#config;
    this.next({
      type: AgentEvent.Type.Output,
      run: {
        id: run.id,
      },
      node,
      output,
    });
  }

  sendRenderUpdate(
    node: { id: string; type: string; version: string },
    update: { step: string; data: any }
  ) {
    const { run } = this.#config;
    this.next({
      type: AgentEvent.Type.Render,
      run: {
        id: run.id,
      },
      node,
      render: {
        step: update.step,
        data: update.data,
      },
    });
  }
}

export { EventStream };
export type { AgentEvent };
