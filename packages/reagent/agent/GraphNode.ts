import {
  BehaviorSubject,
  Observable,
  ReplaySubject,
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
  takeWhile,
  tap,
} from "rxjs";
import { fromError } from "zod-validation-error";

import { Context } from "./context";
import { AbstractAgentNode } from "./node";
import { AgentEvent, EventStream } from "./stream";
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

const VALUE_PROVIDER = Symbol("___VALUE_PROVIDER__");

type RenderUpdateStream = Observable<{
  run: { id: string };
  node: { id: string; type: string; version: string };
  render: {
    step: string;
    data: any;
  };
}> & {
  /**
   * Select the output result by run id
   *
   * @param runId
   */
  select(options: {
    runId: string;
  }): Pick<RenderUpdateStream, "pipe" | "subscribe">;
};

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
  // This is "phantom" field only used for type inference
  _types: { output: Output };

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
    // @ts-expect-error
    this._types = undefined;
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
        const provider = isArray ? concat(providers) : of(providers);

        return provider.pipe(
          switchMap((provider: any) => {
            if (!provider[VALUE_PROVIDER]) {
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
      .pipe(
        tap((e) => {
          const context = this.#buildContext(e.run);
          self.#node.onInputEvent(
            context,
            // @ts-expect-error
            { [e.key]: e.value }
          );
        })
      )
      .pipe(reducer())
      .subscribe((e) => {
        self.#invoke(e.input, e.run);
      });

    runEvents.pipe(groupBy((e) => e.run.id)).subscribe((group) => {
      group
        .pipe(
          tap((e) => {
            const context = this.#buildContext(e.run);
            self.#node.onInputEvent(
              context,
              // @ts-expect-error
              { [e.key]: e.value }
            );
          })
        )
        .pipe(mergeWith(globalEvents))
        // take until total number of the mapped input fields are received
        .pipe(take(totalInputEdges))
        .pipe(reducer())
        .subscribe((e) => {
          self.#invoke(e.input, e.run);
        });
    });
  }

  invoke(input: Input, options: { run?: { id: string } } = {}) {
    const run = {
      id: options.run?.id || uniqueId(),
    };
    const output = this.#invoke(input, run);
    return { run, output };
  }

  /**
   * Returns schema to use this node as a tool in LLM call
   *
   * Note: This should only be used to bind to a node input
   * and shouldn't be used directly
   */
  get schema(): OutputValueProviderInterface<{
    id: string;
    name: string;
    description: string;
    parameters: Record<string, any>;
    node: GraphNode<Config, Input, Output>;
  }> {
    const self = this;
    const metadata = this.#node.metadata;
    const stream = new BehaviorSubject({
      run: null,
      value: {
        id: metadata.id,
        name: metadata.name,
        description: metadata.description!,
        get parameters() {
          return metadata.input;
        },
        node: self,
      },
    });

    // @ts-expect-error
    return Object.defineProperty(stream, VALUE_PROVIDER, {
      value: true,
      enumerable: false,
      writable: false,
      configurable: false,
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
            .pipe(
              filter(
                (e: any) =>
                  e.type == AgentEvent.Type.Output &&
                  e.output[field] != undefined
              )
            )
            .pipe(
              map((e) => {
                return { run: e.run, value: e.output[field] };
              })
            );
          return Object.defineProperties(stream, {
            [VALUE_PROVIDER]: {
              value: true,
              configurable: false,
              enumerable: false,
              writable: false,
            },
            select: {
              value: (options: { runId: string }) => {
                return new Promise((resolve) => {
                  stream
                    .pipe(filter((e: any) => e.run.id == options.runId))
                    .subscribe((e) => {
                      resolve(e.value);
                    });
                });
              },
              enumerable: false,
            },
          });
        },
      }
    );
  }

  /**
   * Note: This should only be used to bind to a node input
   * and shouldn't be used directly
   */
  get render(): RenderUpdateStream {
    // TODO: figure out how to close render stream for run
    const stream = this.#stream
      .pipe(
        filter(
          (e: any) =>
            e.type == AgentEvent.Type.Render ||
            e.type == AgentEvent.Type.RunComplete
        )
      )
      .pipe(
        groupBy((e) => e.run.id, {
          // Note: it is important to use ReplaySubject here
          // otherwise, the group events are lost somehow :shrug:
          connector() {
            return new ReplaySubject();
          },
        })
      )
      .pipe(
        map((group) => {
          return {
            run: {
              id: group.key,
            },
            value: group.pipe(
              takeWhile((e) => e.type != AgentEvent.Type.RunComplete)
            ),
          };
        })
      );

    return Object.defineProperty(stream, VALUE_PROVIDER, {
      value: true,
    }) as unknown as RenderUpdateStream;
  }

  async #invoke(input: Input, run: { id: string }): Promise<Output> {
    const context = this.#buildContext(run);
    // const validation = this.#node.metadata.input.safeParse(input);
    // if (!validation.success) {
    //   throw new Error(
    //     `[node=${this.#node.metadata.id}]: ${fromError(validation.error)}`
    //   );
    // }
    const node = {
      id: this.#nodeId,
      type: this.#node.metadata.id,
      version: this.#node.metadata.version,
    };
    const generator = this.#node.execute(context, input);
    const output = {};
    for await (const partialOutput of generator) {
      this.#stream.sendOutput({
        run,
        node,
        output: partialOutput,
      });
      Object.assign(output, partialOutput);
    }
    this.#stream.next({
      type: AgentEvent.Type.RunComplete,
      run,
      node,
    });
    return output as Output;
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
