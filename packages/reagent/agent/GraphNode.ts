import {
  BehaviorSubject,
  Observable,
  concat,
  filter,
  groupBy,
  map,
  mergeMap,
  mergeWith,
  of,
  partition,
  reduce,
  switchMap,
  take,
} from "rxjs";

import { Context } from "./context";
import { AbstractAgentNode } from "./node";
import { EventStream } from "./stream";
import { uniqueId } from "../utils/uniqueId";

type OutputValueStream<Output> = Observable<{
  // run is null for run independent global values
  run: {
    id: string;
  } | null;
  value: Output;
}>;

type OutputValueProviderInterface<Output> = Pick<
  OutputValueStream<Output>,
  "subscribe" | "pipe"
> & {
  /**
   * Select the output result by run id
   *
   * @param runId
   */
  select(options: { runId: string }): Promise<Output>;
};

const OUTPUT_VALUE_PROVIDER = Symbol("__OUTPUT_VALUE_PROVIDER__");

class GraphNode<
  Config extends Record<string, unknown> | void,
  Input extends Record<string, unknown>,
  Output extends Record<string, unknown>,
  State extends Record<string, unknown> = {},
> {
  #nodeId: string;
  #node: AbstractAgentNode<Config, Input, Output, State>;
  #config: Config;
  #stream: EventStream<Output>;

  constructor(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    config: Config,
    stream: EventStream<Output>
  ) {
    this.#nodeId = nodeId;
    this.#node = node;
    this.#config = config;
    this.#stream = stream;
    this.#node.init(
      this.#buildContext({
        // runId when initializing will be different than when running
        id: "__NODE_INIT__",
      })
    );
  }

  bind(edges: {
    [K in keyof Input]: Required<Input>[K] extends any[]
      ? OutputValueProviderInterface<Required<Input>[K][number]>[]
      : OutputValueProviderInterface<Required<Input>[K]> | Required<Input>[K];
  }) {
    const edgeEntries = Object.entries(edges);
    const totalInputEdges = edgeEntries
      .map(([_, provider]) => {
        return Array.isArray(provider) ? provider.length : 1;
      })
      .reduce((agg, cur) => agg + cur, 0);

    const providers = of(...edgeEntries).pipe(
      mergeMap(([inputField, providers]) => {
        const isArray = Array.isArray(providers);
        const provider = isArray
          ? concat(providers.map((p) => p))
          : of(providers);

        return provider.pipe(
          switchMap((provider: any) => {
            if (!provider[OUTPUT_VALUE_PROVIDER]) {
              // Note: if it's not a output provider, treat it as a value
              return new BehaviorSubject({
                run: null,
                key: inputField,
                isArray,
                value: provider,
              });
            }
            return provider.pipe(
              map((e: any) => {
                return {
                  run: e.run,
                  key: inputField,
                  isArray,
                  value: e.value,
                };
              })
            ) as unknown as Observable<any>;
          })
        );
      })
    );

    const [globalEvents, runEvents] = partition(
      providers,
      (e) => e.run == null
    );

    const reducer = () =>
      reduce<{ run: any; key: string; isArray: boolean; value: any }, any>(
        (acc, cur) => {
          if (acc.run?.id) {
            // run is null for global events
            // so only throw error if run id doesn't match for run events
            if (cur.run != null && acc.run.id != cur.run.id) {
              throw new Error(`unexpected error: run is must match`);
            }
          } else if (cur.run != null) {
            acc["run"] = cur.run;
          }

          if (acc.input[cur.key] == undefined) {
            // if there's more than one value for a given key,
            // reduce them to an array
            acc.input[cur.key] = cur.isArray ? [cur.value] : cur.value;
          } else {
            if (!cur.isArray) {
              throw new Error(
                `Unexpected error: got more than 1 value when only 1 is expected`
              );
            }
            acc.input[cur.key].push(cur.value);
          }
          return acc;
        },
        {
          input: {},
          run: null,
        } as any
      );

    const self = this;
    // If all bound values are global value provider, invoke the execution immediately
    globalEvents
      .pipe(take(totalInputEdges))
      .pipe(reducer())
      .subscribe((e) => {
        self.#invoke(e.run, e.input);
      });

    runEvents.pipe(groupBy((e) => e.run.id)).subscribe((group) => {
      group
        .pipe(mergeWith(globalEvents))
        // take until total number of the mapped input fields are received
        .pipe(take(totalInputEdges))
        .pipe(reducer())
        .subscribe((e) => {
          self.#invoke(e.run, e.input);
        });
    });
  }

  invoke(input: Input) {
    const run = {
      id: uniqueId(),
    };
    this.#invoke(run, input);
    return { run };
  }

  get schema(): OutputValueProviderInterface<{
    name: string;
    description: string;
    parameters: Record<string, any>;
  }> {
    const metadata = this.#node.metadata;
    const stream = new BehaviorSubject({
      run: null,
      value: {
        name: metadata.name,
        description: metadata.description!,
        parameters: {},
      },
    });

    // @ts-expect-error
    return Object.assign(stream, {
      [OUTPUT_VALUE_PROVIDER]: true,
      select(_options: { runId: string }) {
        return new Promise((resolve) => {
          stream.subscribe((schema) => {
            resolve(schema.value);
          });
        });
      },
    });
  }

  get output(): {
    [K in keyof Output]: OutputValueProviderInterface<Output[K]>;
  } {
    const self = this;
    // @ts-expect-error
    return new Proxy(
      {},
      {
        get(_, field) {
          const stream = self.#stream
            .pipe(filter((e: any) => e.output[field] != undefined))
            .pipe(
              map((e) => {
                return { run: e.run, value: e.output[field] };
              })
            );
          return Object.assign(stream, {
            [OUTPUT_VALUE_PROVIDER]: true,
            select(options: { runId: string }) {
              return new Promise((resolve) => {
                stream
                  .pipe(filter((e: any) => e.run.id == options.runId))
                  .subscribe((e) => {
                    resolve(e.value);
                  });
              });
            },
          });
        },
      }
    );
  }

  async #invoke(run: { id: string }, input: Input) {
    const context = this.#buildContext(run);
    const generator = this.#node.execute(context, input);
    for await (const partialOutput of generator) {
      this.#stream.sendOutput({
        run,
        node: {
          id: this.#nodeId,
          type: this.#node.metadata.id,
          version: this.#node.metadata.version,
        },
        output: partialOutput,
      });
    }
  }

  #buildContext(run: Context<any, any>["run"]): Context<any, any> {
    const self = this;
    return {
      run,
      node: {
        id: self.#nodeId,
      },
      config: this.#config || {},
      sendOutput(output: Output) {
        self.#stream.sendOutput({
          run,
          node: {
            id: self.#nodeId,
            type: self.#node.metadata.id,
            version: self.#node.metadata.version,
          },
          output,
        });
      },
      render(step, data) {
        // since this runs in server side, render will be transpiled to only pass component id
        const stepId = step as unknown as string;
        const node = {
          id: self.#nodeId,
          type: self.#node.metadata.id,
          version: self.#node.metadata.version,
        };
        self.#stream.sendRenderUpdate({
          run,
          node,
          update: {
            step: stepId,
            data,
          },
        });
        return {
          update(data) {
            self.#stream.sendRenderUpdate({
              run,
              node,
              update: {
                step: stepId,
                data,
              },
            });
          },
        };
      },
    };
  }
}

export { GraphNode };
