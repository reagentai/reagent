import {
  Observable,
  filter,
  groupBy,
  map,
  mergeMap,
  of,
  reduce,
  take,
} from "rxjs";

import { Context } from "./context";
import { AbstractAgentNode, EmptyAgentState } from "./node";
import { EventStream } from "./stream";
import { ZodObjectSchema } from "./types";
import { z } from "./zod";
import { uniqueId } from "../utils/uniqueId";

type OutputValueStream<Output> = Observable<{
  run: { id: string };
  value: Output;
}>;

type OutputValueProvider<Key, Output> = {
  field: string;
  stream: EventStream<{ run: { id: string }; value: Output }>;
} & Pick<OutputValueStream<Output>, "subscribe">;

class GraphNode<
  Config extends ZodObjectSchema | z.ZodVoid,
  Input extends ZodObjectSchema,
  Output extends ZodObjectSchema,
  State extends ZodObjectSchema = EmptyAgentState,
> {
  nodeId: string;
  node: AbstractAgentNode<Config, Input, Output, State>;
  #config: z.infer<Config>;
  #stream: EventStream<z.infer<Output>>;

  constructor(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    config: z.infer<Config>,
    stream: EventStream<z.infer<Output>>
  ) {
    this.nodeId = nodeId;
    this.node = node;
    this.#config = config;
    this.#stream = stream;
    this.node.init(
      this.#buildContext({
        // runId when initializing will be different than when running
        id: "__NODE_INIT__",
      })
    );
  }

  get output(): {
    [K in keyof z.infer<Output>]: OutputValueProvider<K, z.infer<Output>[K]>;
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
          return {
            stream,
            field,
            subscribe(callback: any) {
              return stream.subscribe(callback);
            },
          };
        },
      }
    );
  }

  bind(edges: {
    [K in keyof z.infer<Input>]: OutputValueProvider<
      K,
      Required<z.infer<Input>>[K]
    >;
  }) {
    const self = this;
    const edgeEntries = Object.entries(edges);
    of(...edgeEntries)
      .pipe(
        mergeMap(([inputField, value]) => {
          const { stream } = value as OutputValueProvider<
            string,
            z.infer<Output>
          >;
          return stream.pipe(
            map((e: any) => {
              return {
                run: e.run,
                key: inputField,
                value: e.value,
              };
            })
          );
        })
      )
      .pipe(groupBy((e) => e.run.id))
      .subscribe((group) => {
        group
          // take until total number of the mapped input fields are received
          .pipe(take(edgeEntries.length))
          .pipe(
            reduce(
              (acc, cur) => {
                if (acc.run && acc.run.id != cur.run.id) {
                  throw new Error(`unexpected error: run is must match`);
                } else {
                  acc["run"] = cur.run;
                }
                acc.input[cur.key] = cur.value;
                return acc;
              },
              {
                input: {},
              } as any
            )
          )
          .subscribe((e) => {
            self.#invoke(e.run, e.input);
          });
      });
  }

  async invoke(input: z.infer<Input>) {
    const run = {
      id: uniqueId(),
    };
    this.#invoke(run, input);
  }

  async #invoke(run: { id: string }, input: z.infer<Input>) {
    const context = this.#buildContext(run);
    const generator = this.node.run(context, input);
    for await (const partialOutput of generator) {
      this.#stream.sendOutput({
        run,
        node: {
          id: this.nodeId,
          type: this.node.metadata.id,
          version: this.node.metadata.version,
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
        id: self.nodeId,
      },
      config: this.#config || {},
      sendOutput(output: z.infer<Output>) {
        self.#stream.sendOutput({
          run,
          node: {
            id: self.nodeId,
            type: self.node.metadata.id,
            version: self.node.metadata.version,
          },
          output,
        });
      },
      render(step, data) {
        // since this runs in server side, render will be transpiled to only pass component id
        const stepId = step as unknown as string;
        const node = {
          id: self.nodeId,
          type: self.node.metadata.id,
          version: self.node.metadata.version,
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
