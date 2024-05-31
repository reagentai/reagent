import { Observable } from "rxjs";

export type DependencyNode = {
  // dependency node id
  id: string;
  type: string;
  version: string;
};

export type OutputValueProvider<Output> = Pick<
  Observable<{
    // run is null for run independent global values
    run: {
      id: string;
    } | null;
    value: Output;
  }>,
  "subscribe"
> & {
  map<O>(cb: (value: Output, run: { id: string }) => O): OutputValueProvider<O>;
};

export type OutputValueProviderWithSelect<Output> =
  OutputValueProvider<Output> & {
    /**
     * Select the output result by run id
     *
     * @param runId
     */
    select(options: { runId: string }): Promise<Output>;
  };

export type RenderUpdate = {
  node: { id: string; type: string; version: string };
  render: {
    step: string;
    data: any;
  };
};
