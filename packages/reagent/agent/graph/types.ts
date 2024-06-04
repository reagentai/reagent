import { Observable } from "rxjs";

export type DependencyNode = {
  // dependency node id
  id: string;
  type: string;
  version: string;
};

type OutputValueEvent<Output> = {
  // session is null for session independent global values
  session: {
    id: string;
  } | null;
  value: Output;
};

export type OutputValueProvider<Output> = Pick<
  Observable<OutputValueEvent<Output>>,
  "subscribe" | "pipe"
> & {
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
