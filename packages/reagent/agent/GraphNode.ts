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
import { AbstractAgentNode } from "./node";
import { EventStream } from "./stream";
import { uniqueId } from "../utils/uniqueId";

type OutputValueStream<Output> = Observable<{
  run: { id: string };
  value: Output;
}>;

type OutputValueProvider<Output> = Pick<
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
    [K in keyof Input]: OutputValueProvider<Required<Input>[K]>;
  }) {
    const self = this;
    const edgeEntries = Object.entries(edges);
    of(...edgeEntries)
      .pipe(
        mergeMap(([inputField, value]) => {
          const provider = value as OutputValueProvider<Output>;
          return provider.pipe(
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

  invoke(input: Input) {
    const run = {
      id: uniqueId(),
    };
    this.#invoke(run, input);
    return { run };
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
            .pipe(filter((e: any) => e.output[field] != undefined))
            .pipe(
              map((e) => {
                return { run: e.run, value: e.output[field] };
              })
            );

          Object.assign(stream, {
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

          return stream;
        },
      }
    );
  }

  async #invoke(run: { id: string }, input: Input) {
    const context = this.#buildContext(run);
    const generator = this.#node.run(context, input);
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
