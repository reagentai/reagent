import { ReplaySubject } from "rxjs";

type EventStreamConfig = {
  run: {
    id: string;
  };
};

class EventStream<Output> extends ReplaySubject<any> {
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

  sendOutput(node: { id: string; type: string }, output: Output) {
    const { run } = this.#config;
    this.next({
      type: "output",
      run: {
        id: run.id,
      },
      node,
      output,
    });
  }
}

export { EventStream };
