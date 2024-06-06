import {
  Observable,
  delay,
  filter,
  groupBy,
  map,
  merge,
  mergeMap,
  of,
  reduce,
  share,
  take,
  takeUntil,
  zip,
} from "rxjs";
import { fromError } from "zod-validation-error";
import { uniqBy } from "lodash-es";

import { Context } from "../context.js";
import { AbstractAgentNode } from "../node.js";
import { EventStream, AgentEventType, AgentEvent } from "../stream.js";
import { uniqueId } from "../../utils/uniqueId.js";
import { VALUE_PROVIDER, __tagValueProvider } from "./operators.js";

import type {
  NodeDependency,
  OutputValueProvider,
  OutputValueProviderWithSelect,
  RenderUpdate,
} from "./types";

type MappedInputEvent = {
  session: { id: string };
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
  // this is used to cache the output stream by field to void
  // duplicate filtering/computation when same output field
  // is used more than once
  #_outputStreams: Record<string, any>;
  #_renderStream: any;
  #_nodeFinishedStream: Observable<AgentEvent<Output, any>>;
  #dependencies: NodeDependency[];
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
    this.#dependencies = [];
    this.#node.init(
      this.#buildContext({
        // sessionId when initializing will be different than when running
        id: "__NODE_INIT__",
      })
    );
    this.#_outputStreams = {};
    this.#_nodeFinishedStream = stream.pipe(
      filter(
        (e) =>
          e.type == AgentEventType.RunCompleted ||
          e.type == AgentEventType.RunSkipped
      )
    );

    // @ts-expect-error
    this._types = undefined;
  }

  get dependencies() {
    return this.#dependencies;
  }

  bind(edges: {
    [K in keyof Input]: Input[K] extends OutputValueProvider<Input[K]>
      ? OutputValueProvider<Input[K]>
      :
          | Required<Input>[K]
          | OutputValueProvider<Required<Input>[K]>
          | Required<Input>[K];
  }) {
    const self = this;
    const allProviders = Object.entries(edges);
    const providers: {
      targetField: string;
      type: string | undefined;
      provider: OutputValueProvider<any>;
      dependencies: NodeDependency[];
      isArray: boolean;
    }[] = allProviders.flatMap(([targetField, provider]: any) => {
      // if it's an array, use it as value but extract it's dependencies
      // this is needed because schema can be passed in an array
      if (Array.isArray(provider)) {
        return provider.map((p: any) => {
          return {
            targetField,
            ...(p[VALUE_PROVIDER] || {}),
            provider: p,
            isArray: true,
          };
        });
      } else {
        return [
          {
            targetField,
            ...(provider[VALUE_PROVIDER] || {}),
            provider,
            isArray: false,
          },
        ];
      }
    });

    this.#dependencies = providers
      .flatMap((p) => p.dependencies)
      .filter((d) => Boolean(d));

    const outputSourceProviders = providers.filter((p) => p.type == "output");
    const uniqueOutputProviderNodes = new Set(
      outputSourceProviders.flatMap((p) => p.dependencies.map((d: any) => d.id))
    );

    const valueProviders = providers.filter((p) => p.type == undefined);
    const schemaSources = providers.filter((p) => p.type == "schema");
    const renderSources = providers.filter((p) => p.type == "render");

    // TODO: this render streams replays all previous renders
    // figure out how to clean up old events
    // one idea is to pass TimestampProvider in replay event stream
    const renderStreams = of(...renderSources).pipe(
      mergeMap(({ targetField, provider, isArray }) =>
        provider.pipe(
          map((pe: any) => {
            return {
              type: "node/render",
              session: pe.session,
              targetField,
              isArray,
              value: pe.value,
            };
          })
        )
      )
    );

    self.#stream.pipe(groupBy((e) => e.session.id)).subscribe((group) => {
      // trigger when this current node is completed/skipped
      const nodeCompleted = self.#_nodeFinishedStream
        .pipe(
          filter((e) => e.session.id == group.key && e.node.id == self.#nodeId)
        )
        .pipe(take(1));

      const outputProvidersCompleted = this.#_nodeFinishedStream
        .pipe(
          filter((e) => {
            return (
              e.session.id == group.key &&
              uniqueOutputProviderNodes.has(e.node.id)
            );
          })
        )
        .pipe(take(uniqueOutputProviderNodes.size));

      const outputProviderStream = group
        .pipe(take(1))
        .pipe(
          mergeMap((e1) => {
            return merge<MappedInputEvent[]>(
              ...outputSourceProviders.map((node) => {
                return node.provider
                  .pipe(filter((e) => e.session!.id == e1.session.id))
                  .pipe(take(1))
                  .pipe(
                    map((outputEvent) => {
                      return {
                        type: AgentEventType.Output,
                        session: outputEvent.session!,
                        targetField: node.targetField,
                        isArray: node.isArray,
                        value: outputEvent.value,
                      };
                    })
                  );
              })
            );
          })
        )
        .pipe(
          takeUntil(
            outputProvidersCompleted
              // add a delay to allow `outputProviderStream` to process the events
              // if the outputs from all outputSourceProviders are already received,
              // the delay won't have any effect
              .pipe(delay(30_000))
          ),
          take(outputSourceProviders.length)
        );

      const valueProviderStreams = group
        .pipe(filter((e) => e.type == AgentEventType.SessionStarted))
        .pipe(take(1))
        .pipe(
          mergeMap((e) => {
            return merge(
              ...valueProviders.map(({ targetField, provider, isArray }) => {
                return of({
                  type: "raw",
                  session: e.session,
                  targetField,
                  isArray,
                  value: provider,
                });
              })
            );
          })
        )
        .pipe(take(valueProviders.length))
        .pipe(share());

      const schemaProviderStream = group
        .pipe(filter((e) => e.type == AgentEventType.SessionStarted))
        .pipe(take(1))
        .pipe(
          mergeMap((e) => {
            return merge(
              ...schemaSources.map(({ targetField, provider, isArray }) => {
                return of({
                  type: "node/schema",
                  session: e.session,
                  targetField,
                  isArray,
                  value: provider,
                });
              })
            );
          })
        )
        .pipe(take(schemaSources.length));

      const renderStream = renderStreams
        .pipe(
          filter((e: any) => {
            return e.session.id == group.key;
          })
        )
        .pipe(take(renderSources.length));

      const schemaSourceDependencies = uniqBy(
        schemaSources.flatMap((s) => s.dependencies),
        (d) => d.id
      );
      const schemaSourceDependencyIds = new Set(
        schemaSourceDependencies.map((d) => d.id)
      );

      const schemaNodesRunStream = group
        .pipe(takeUntil(nodeCompleted))
        .pipe(
          filter(
            (e) =>
              (e.type == AgentEventType.RunCompleted ||
                e.type == AgentEventType.RunSkipped) &&
              schemaSourceDependencyIds.has(e.node.id)
          )
        )
        .pipe(
          reduce((agg, cur) => {
            agg.add(cur.node.id);
            return agg;
          }, new Set())
        );

      // trigger run skipped for nodes whose schema is bound
      zip(nodeCompleted, schemaNodesRunStream).subscribe(
        ([runComplete, schemaNodesThatWasRun]) => {
          [...schemaSourceDependencies].forEach((schemaSourceNode) => {
            if (!schemaNodesThatWasRun.has(schemaSourceNode.id)) {
              self.#stream.next({
                type: AgentEventType.RunSkipped,
                session: runComplete.session,
                node: schemaSourceNode,
              });
            }
          });
        }
      );

      // group events by target field and emit input events
      merge(
        outputProviderStream,
        schemaProviderStream,
        renderStream,
        valueProviderStreams
      )
        .pipe(groupBy((e) => e.targetField))
        .subscribe({
          next(group) {
            group
              // idk why this is needed even though I assume group
              // will be completed when input streams are completed
              // but maybe mergeing completed stream doesn't close
              // down stream observable :shrug:
              .pipe(take(1))
              .pipe(inputReducer())
              .subscribe((e) => {
                // TODO: not sure if this is being closed properly when a node is skipped
                const context = self.#buildContext(e.session);
                if (e.count > 0) {
                  self.#node.onInputEvent(context, e.input);
                }
              });
          },
          complete() {},
          error(err) {
            throw new Error(err);
          },
        });

      // merge all inputs and invoke the step
      zip(
        outputProvidersCompleted,
        merge(
          outputProviderStream,
          schemaProviderStream,
          renderStream,
          valueProviderStreams
        ).pipe(inputReducer())
      ).subscribe({
        next([runCompleteEvent, inputEvent]) {
          if (
            inputEvent.count ==
            outputSourceProviders.length +
              schemaSources.length +
              renderSources.length +
              valueProviders.length
          ) {
            self.#invoke(inputEvent.input, inputEvent.session);
          } else {
            // if all output provider nodes are completed but all expected inputs
            // weren't received, emit node skipped event
            self.#stream.next({
              type: AgentEventType.RunSkipped,
              session: runCompleteEvent.session,
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

  invoke(input: Input, options: { session?: { id: string } } = {}) {
    const session = {
      id: options.session?.id || uniqueId(),
    };
    const self = this;
    if (!options.session?.id) {
      this.#stream.next({
        type: AgentEventType.SessionStarted,
        node: {
          id: self.#nodeId,
          type: self.#node.metadata.id,
          version: self.#node.metadata.version,
        },
        session,
      });
    }
    const output = this.#invoke(input, session);
    return { session, output };
  }

  /**
   * Returns schema to use this node as a tool in LLM call
   *
   * Note: This should only be used to bind to a node input
   * and shouldn't be used directly
   */
  get schema(): {
    id: string;
    name: string;
    description: string;
    parameters: Record<string, any>;
    node: GraphNode<Config, Input, Output>;
  } {
    const self = this;
    const metadata = this.#node.metadata;
    const stream = {
      id: metadata.id,
      name: metadata.name,
      description: metadata.description!,
      get parameters() {
        return metadata.input;
      },
      node: self,
    };

    return Object.defineProperty(stream, VALUE_PROVIDER, {
      value: {
        type: "schema",
        dependencies: [
          {
            id: self.#nodeId,
            type: self.#node.metadata.id,
            version: self.#node.metadata.version,
            field: "schema",
          },
        ],
      },
      enumerable: false,
      writable: false,
      configurable: false,
    });
  }

  get output(): {
    [K in keyof Output]: OutputValueProviderWithSelect<Output[K]>;
  } {
    const self = this;
    // @ts-expect-error
    return new Proxy(
      {},
      {
        get(_, field: string) {
          let stream = self.#_outputStreams[field];
          if (stream) {
            return stream;
          }
          stream = self.#stream
            .pipe(
              filter(
                (e: any) =>
                  e.type == AgentEventType.Output &&
                  e.node.id == self.#nodeId &&
                  field in e.output
              )
            )
            .pipe(
              map((e) => {
                return { session: e.session, field, value: e.output[field] };
              })
            );

          stream = __tagValueProvider(stream, [
            {
              id: self.#nodeId,
              type: self.#node.metadata.id,
              version: self.#node.metadata.version,
              field,
            },
          ]);
          Object.defineProperties(stream, {
            select: {
              get value() {
                return (options: { sessionId: string }) => {
                  return new Promise((resolve, reject) => {
                    stream
                      .pipe(
                        filter((e: any) => e.session.id == options.sessionId)
                      )
                      .pipe(
                        takeUntil(
                          self.#_nodeFinishedStream
                            .pipe(
                              filter(
                                (e) =>
                                  e.session.id == options.sessionId &&
                                  e.node.id == self.#nodeId
                              )
                            )
                            .pipe(take(1))
                        )
                      )
                      .pipe(take(1))
                      .subscribe({
                        next(e: any) {
                          resolve(e.value);
                        },
                        complete() {
                          reject(
                            `Node [${self.#nodeId}] didn't output field: ${field}`
                          );
                        },
                      });
                  });
                };
              },
              enumerable: false,
            },
          });
          self.#_outputStreams[field] = stream;
          return stream as OutputValueProvider<Output>;
        },
      }
    );
  }

  /**
   * Note: This should only be used to bind to a node input
   * and shouldn't be used directly
   */
  // TODO: if render stream is used, make sure the node's schema
  // is also bound; otherwise, the render stream won't close
  get render(): OutputValueProvider<Observable<RenderUpdate>> {
    const self = this;
    if (self.#_renderStream) {
      return self.#_renderStream;
    }
    const stream = self.#stream
      .pipe(
        filter(
          (e: any) =>
            // filter either any run invoked events or events for this node
            (e.type == AgentEventType.Render && e.node.id == self.#nodeId) ||
            e.type == AgentEventType.SessionStarted
        )
      )
      .pipe(groupBy((e) => e.session.id))
      .pipe(
        map((group) => {
          const runCompleted = self.#_nodeFinishedStream
            .pipe(
              filter(
                (e) => group.key == e.session.id && e.node.id == self.#nodeId
              )
            )
            .pipe(take(1));
          // TODO: removing this doesn't stream render events; BUT WHY?
          group.subscribe(() => {});
          return {
            session: {
              id: group.key,
            },
            value: group
              .pipe(filter((e) => e.type == AgentEventType.Render))
              .pipe(takeUntil(runCompleted)),
          };
        })
      )
      .pipe(share());

    Object.defineProperties(stream, {
      [VALUE_PROVIDER]: {
        value: {
          type: "render",
          dependencies: [
            {
              id: self.#nodeId,
              type: self.#node.metadata.id,
              version: self.#node.metadata.version,
              field: "__render__",
            },
          ],
        },
        configurable: false,
        enumerable: false,
        writable: false,
      },
      select: {
        value: (options: { sessionId: string }) => {
          return new Promise((resolve, reject) => {
            stream
              .pipe(filter((e: any) => e.session.id == options.sessionId))
              .subscribe({
                next(e: any) {
                  resolve(e.value);
                },
                complete() {
                  reject(`Node [${self.#nodeId}] didn't render anythin`);
                },
              });
          });
        },
        enumerable: false,
      },
    });

    self.#_renderStream = stream;
    return stream as unknown as OutputValueProvider<Observable<RenderUpdate>>;
  }

  async #invoke(input: Input, session: { id: string }): Promise<Output> {
    const context = this.#buildContext(session);
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
        session,
        node,
        output: partialOutput,
      });
      Object.assign(output, partialOutput);
    }
    this.#stream.next({
      type: AgentEventType.RunCompleted,
      session,
      node,
    });
    return output as Output;
  }

  #buildContext(session: Context<any, any>["session"]): Context<any, any> {
    const self = this;
    return {
      session,
      node: {
        id: self.#nodeId,
      },
      config: this.#config || {},
      sendOutput(output: Output) {
        self.#stream.sendOutput({
          session,
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
          session,
          node,
          update: {
            step: stepId,
            data,
          },
        });
        return {
          update(data) {
            self.#stream.sendRenderUpdate({
              session,
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
  reduce<MappedInputEvent, any>(
    (acc, cur) => {
      // Note: ignore undefined values
      if (cur.value == undefined) {
        return acc;
      }
      if (acc.session?.id) {
        // run is null for global events
        // so only throw error if session id doesn't match for run events
        if (cur.session != null && acc.session.id != cur.session.id) {
          throw new Error(`unexpected error: session id must match`);
        }
      } else if (cur.session != null) {
        acc["session"] = cur.session;
      }

      if (acc.input[cur.targetField] == undefined) {
        // if there's more than one value for a given key,
        // reduce them to an array
        acc.input[cur.targetField] = cur.isArray ? [cur.value] : cur.value;
      } else {
        if (cur.isArray) {
          acc.input[cur.targetField].push(cur.value);
        } else {
          throw new Error(
            `Unexpected error: got more than 1 value when only 1 is expected`
          );
        }
      }
      acc.count += 1;
      return acc;
    },
    {
      input: {},
      session: null,
      count: 0,
    } as any
  );

export { GraphNode };
export type { OutputValueProvider };
