import {
  Observable,
  concat,
  filter,
  groupBy,
  map,
  merge,
  mergeMap,
  of,
  reduce,
  take,
  takeUntil,
  zip,
} from "rxjs";
import { fromError } from "zod-validation-error";

import { Context } from "../context";
import { AbstractAgentNode } from "../node";
import { AgentEvent, EventStream } from "../stream";
import { uniqueId } from "../../utils/uniqueId";

type OutputValueProvider<Output> = Pick<
  Observable<{
    // run is null for run independent global values
    run: {
      id: string;
    } | null;
    value: Output;
  }>,
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

type RenderUpdate = {
  node: { id: string; type: string; version: string };
  render: {
    step: string;
    data: any;
  };
};

type MappedInputEvent = {
  type: AgentEvent.Type;
  run: { id: string };
  sourceField: string;
  targetField: string;
  isArray: boolean;
  value: any;
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
    [K in keyof Input]: Input[K] extends OutputValueProvider<Input[K]>
      ? OutputValueProvider<Input[K]>
      : Required<Input>[K] extends any[]
        ? OutputValueProvider<Required<Input>[K][number]>[]
        : OutputValueProvider<Required<Input>[K]> | Required<Input>[K];
  }) {
    const self = this;
    const allProviders = Object.entries(edges);
    const providers = allProviders.flatMap(([targetField, provider]: any) => {
      if (Array.isArray(provider)) {
        return provider.map((p) => {
          return {
            targetField,
            ...p[VALUE_PROVIDER],
            provider: p,
          };
        });
      }
      return [
        {
          targetField,
          ...provider[VALUE_PROVIDER],
          provider,
        },
      ];
    });

    const outputSourceFields = providers.filter((p) => p.type == "output");
    const uniqueOutputProviderNodes = new Set(
      outputSourceFields.map((p) => p.nodeId)
    );

    const schemaSources = providers.filter((p) => p.type == "schema");

    self.#stream.pipe(groupBy((e) => e.run.id)).subscribe((group) => {
      const outputProvidersCompleted = group
        .pipe(
          filter((e) => {
            return (
              e.type == AgentEvent.Type.RunCompleted &&
              uniqueOutputProviderNodes.has(e.node.id)
            );
          })
        )
        .pipe(take(uniqueOutputProviderNodes.size));

      const outputProviderStream = group
        .pipe(
          filter((e) => {
            return (
              e.type == AgentEvent.Type.Output &&
              uniqueOutputProviderNodes.has(e.node.id)
            );
          })
        )
        .pipe(
          mergeMap((e: any) => {
            const fieldMappings = Object.fromEntries(
              providers
                .filter((n) => n.nodeId == e.node.id)
                .map((n) => {
                  return [n.sourceField, n.targetField];
                })
            );
            // emit event for each output key used by the node
            return of<MappedInputEvent[]>(
              ...Object.entries(e.output)
                .filter(([sourceField]) => fieldMappings[sourceField])
                .map(([sourceField, value]) => {
                  const targetField = fieldMappings[sourceField];
                  return {
                    type: e.type,
                    run: e.run,
                    node: e.node,
                    sourceField,
                    targetField,
                    isArray: Array.isArray(edges[targetField]),
                    value,
                  };
                })
            );
          })
        )
        .pipe(takeUntil(outputProvidersCompleted))
        .pipe(take(outputSourceFields.length));

      const schemaProviderStream = group
        .pipe(filter((e) => e.type == AgentEvent.Type.RunInvoked))
        .pipe(take(1))
        .pipe(
          mergeMap((e) => {
            return concat<MappedInputEvent[]>(
              ...schemaSources.map(({ targetField, provider }) => {
                return provider.pipe(take(1)).pipe(
                  map((schema) => {
                    return {
                      type: AgentEvent.Type.NodeSchema,
                      run: e.run,
                      sourceField: "schema",
                      targetField,
                      isArray: Array.isArray(edges[targetField]),
                      value: schema,
                    };
                  })
                );
              })
            );
          })
        )
        .pipe(take(schemaSources.length));

      // group events by target field and emit input events
      merge(outputProviderStream, schemaProviderStream)
        .pipe(groupBy((e) => e.targetField))
        .subscribe({
          next(group) {
            group.pipe(inputReducer()).subscribe((e) => {
              const context = self.#buildContext(e.run);
              if (e.count > 0) {
                self.#node.onInputEvent(context, e.input);
              }
            });
          },
          complete() {},
          error(_err) {},
        });

      // merge all inputs and invoke the step
      zip(
        outputProvidersCompleted,
        merge(outputProviderStream, schemaProviderStream).pipe(inputReducer())
      ).subscribe({
        next([runCompleteEvent, inputEvent]) {
          if (
            inputEvent.count ==
            outputSourceFields.length + schemaSources.length
          ) {
            self.#invoke(inputEvent.input, inputEvent.run);
          } else {
            // if all output provider nodes are completed but all expected inputs
            // weren't received, emit node skipped event
            self.#stream.next({
              type: AgentEvent.Type.RunSkipped,
              run: runCompleteEvent.run,
              node: {
                id: self.#nodeId,
                type: self.#node.metadata.id,
                version: self.#node.metadata.version,
              },
            });
          }
        },
        complete() {},
        error(_err) {},
      });
    });
  }

  invoke(input: Input, options: { run?: { id: string } } = {}) {
    const run = {
      id: options.run?.id || uniqueId(),
    };
    const self = this;
    if (!options.run?.id) {
      this.#stream.next({
        type: AgentEvent.Type.RunInvoked,
        node: {
          id: self.#nodeId,
          type: self.#node.metadata.id,
          version: self.#node.metadata.version,
        },
        run,
      });
    }
    const output = this.#invoke(input, run);
    return { run, output };
  }

  /**
   * Returns schema to use this node as a tool in LLM call
   *
   * Note: This should only be used to bind to a node input
   * and shouldn't be used directly
   */
  get schema(): OutputValueProvider<{
    id: string;
    name: string;
    description: string;
    parameters: Record<string, any>;
    node: GraphNode<Config, Input, Output>;
  }> {
    const self = this;
    const metadata = this.#node.metadata;
    const stream = of({
      id: metadata.id,
      name: metadata.name,
      description: metadata.description!,
      get parameters() {
        return metadata.input;
      },
      node: self,
    });

    // @ts-expect-error
    return Object.defineProperty(stream, VALUE_PROVIDER, {
      value: {
        type: "schema",
        nodeId: self.#nodeId,
      },
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  get output(): {
    [K in keyof Output]: OutputValueProvider<Output[K]>;
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
                  e.node.id == self.#nodeId &&
                  field in e.output
              )
            )
            .pipe(
              map((e) => {
                return { run: e.run, field, value: e.output[field] };
              })
            );

          return Object.defineProperties(stream, {
            [VALUE_PROVIDER]: {
              value: {
                type: "output",
                nodeId: self.#nodeId,
                sourceField: field,
              },
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
   * Merges two streams into one
   *
   * If a node has a stream input but need to take in stream
   * from more than one output/render, then this can be used to combine the
   * streams;
   *
   * For example:
   * ```
   * user.mergeStream(error.render, getWeather.render),
   * ```
   *
   * @param renders
   * @returns
   */
  mergeStream<O>(...renders: OutputValueProvider<O>[]): OutputValueProvider<O> {
    const stream = concat(
      // @ts-expect-error
      ...renders
    );
    return Object.defineProperty(stream, VALUE_PROVIDER, {
      value: true,
    }) as unknown as OutputValueProvider<O>;
  }

  /**
   * Note: This should only be used to bind to a node input
   * and shouldn't be used directly
   */
  get render(): OutputValueProvider<Observable<RenderUpdate>> {
    return {} as any;
    // // TODO: figure out how to close render stream for run
    // const stream = this.#stream
    //   .pipe(
    //     filter(
    //       (e: any) =>
    //         e.type == AgentEvent.Type.Render ||
    //         e.type == AgentEvent.Type.RunCompleted
    //     )
    //   )
    //   .pipe(
    //     groupBy((e) => e.run.id, {
    //       // Note: it is important to use ReplaySubject here
    //       // otherwise, the group events are lost somehow :shrug:
    //       connector() {
    //         return new ReplaySubject();
    //       },
    //     })
    //   )
    //   .pipe(
    //     map((group) => {
    //       return {
    //         run: {
    //           id: group.key,
    //         },
    //         value: group.pipe(
    //           takeWhile((e) => e.type != AgentEvent.Type.RunCompleted)
    //         ),
    //       };
    //     })
    //   );
    // return Object.defineProperty(stream, VALUE_PROVIDER, {
    //   value: true,
    // }) as unknown as OutputValueProvider<Observable<RenderUpdate>>;
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
      type: AgentEvent.Type.RunCompleted,
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

const inputReducer = () =>
  reduce<{ run: any; targetField: string; isArray: boolean; value: any }, any>(
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

      if (acc.input[cur.targetField] == undefined) {
        // if there's more than one value for a given key,
        // reduce them to an array
        acc.input[cur.targetField] = cur.isArray ? [cur.value] : cur.value;
      } else {
        if (!cur.isArray) {
          throw new Error(
            `Unexpected error: got more than 1 value when only 1 is expected`
          );
        }
        acc.input[cur.targetField].push(cur.value);
      }
      acc.count += 1;
      return acc;
    },
    {
      input: {},
      run: null,
      count: 0,
    } as any
  );

export { GraphNode };
export type { OutputValueProvider };
