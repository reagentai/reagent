import { Observable } from "rxjs";

export type NodeMetadata = {
  // node id
  id: string;
  type: string;
  version: string;
};

export type OutputValueEvent<Output> = {
  // session is null for session independent global values
  session: {
    id: string;
  } | null;
  node: NodeMetadata;
  value: Output;
};

export type OutputValueProvider<Output> = Pick<
  Observable<OutputValueEvent<Output>>,
  "subscribe" | "pipe"
> & {
  filter<O>(options: {
    session: { id: string };
  }): Pick<Observable<OutputValueEvent<Output>>, "subscribe" | "pipe">;
  map<O>(
    cb: (value: Output, session: { id: string }) => O
  ): OutputValueProvider<O>;
  _event: OutputValueEvent<Output>;
};

export type OutputValueProviderWithSelect<Output> =
  OutputValueProvider<Output> & {
    /**
     * Select the output result by session id
     *
     * Promise will be rejected if the output for the session
     * wasn't emitted
     *
     * @param sessionId
     */
    select(options: { sessionId: string }): Promise<Output>;
  };

export type RenderUpdate = {
  node: { id: string; type: string; version: string };
  render: {
    step: string;
    data: any;
  };
};

export type NodeDependency = {
  id: string;
  type: string;
  version: string;
  field: string;
};
