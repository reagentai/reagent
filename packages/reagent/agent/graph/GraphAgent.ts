import { Observable, Observer, Subscription, map, merge } from "rxjs";
import { pick } from "lodash-es";
import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";

import { GraphNode, NODE_OUTPUT_FIELD } from "./GraphNode.js";
import { AbstractAgentNode } from "../node.js";
import { EventStream } from "../stream.js";
import { VALUE_PROVIDER } from "./operators.js";
import type {
  OutputValueEvent,
  OutputValueProvider,
  RenderUpdate,
} from "./types";
import { z } from "../zod.js";

type OutputBindings = {
  markdown?: OutputValueProvider<any>[];
  markdownStream?: OutputValueProvider<any>[];
  ui?: OutputValueProvider<Observable<RenderUpdate>>[];
};

type AgentConfig = {
  name: string;
  description: string;
  replayBuffer?: number;
};

type AddNodeOptions<Config> = {
  config?: Config;
  label?: string;
};

class GraphAgent {
  #config: AgentConfig;
  #nodesById: Map<
    string,
    {
      node: any;
      options: AddNodeOptions<any>;
      graphNode: GraphNode<any, any, any, any>;
    }
  >;
  #stream: EventStream<any>;
  #outputBindings?: OutputBindings;
  constructor(config: AgentConfig) {
    this.#config = config;
    this.#stream = new EventStream({
      // as long as single session doesn't have more than 2_000 events,
      // this should be fine for now. Note, each markdown stream is a
      // single event, so it should be fine
      buffer: 2_000,
    });
    this.#nodesById = new Map();
  }

  get name() {
    return this.#config.name;
  }

  get description() {
    return this.#config.description;
  }

  bind(bindings: OutputBindings) {
    if (Boolean(this.#outputBindings)) {
      throw new Error("Agent outputs already bound!");
    }
    this.#outputBindings = bindings;
  }

  get output() {
    const self = this;
    const createStream = (binding: keyof OutputBindings) => {
      return {
        filter(options: { session: { id: string } }) {
          return merge(
            ...(self.#outputBindings?.[binding] || []).map((obs) => {
              return obs.filter(options).pipe(
                map<any, OutputValueEvent<any>>((e: any) => {
                  return {
                    ...e,
                    // @ts-expect-error
                    node: obs[NODE_OUTPUT_FIELD].node,
                  };
                })
              );
            })
          );
        },
      };
    };
    return {
      get markdown() {
        return createStream("markdown");
      },
      get markdownStream() {
        return createStream("markdownStream");
      },
      get ui() {
        return createStream("ui");
      },
    };
  }

  subscribe(
    callback: Partial<Observer<any>> | ((value: any) => void)
  ): Subscription {
    return this.#stream.subscribe(callback);
  }

  getNode<
    Config extends Record<string, unknown> | void,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
    State extends Record<string, unknown> = {},
  >(nodeId: string) {
    return this.#nodesById.get(nodeId)?.graphNode as
      | GraphNode<Config, Input, Output, State>
      | undefined;
  }

  addNode<
    Config extends void,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
    State extends Record<string, unknown> = {},
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    options?: Omit<AddNodeOptions<Config>, "config">
  ): GraphNode<Config, Input, Output, State>;
  addNode<
    Config extends Record<string, unknown>,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
    State extends Record<string, unknown> = {},
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    options: AddNodeOptions<Config>
  ): GraphNode<Config, Input, Output, State>;
  addNode<
    Config extends Record<string, unknown> | void,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
    State extends Record<string, unknown> = {},
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    options: AddNodeOptions<Config> = {}
  ) {
    if (this.#nodesById.has(nodeId)) {
      throw new Error(`node with id [${nodeId}] already exists`);
    }
    const graphNode = new GraphNode(
      nodeId,
      node,
      options?.config,
      this.#stream
    );
    this.#nodesById.set(nodeId, { node, options, graphNode });
    return graphNode;
  }

  generateGraph() {
    const nodes = [...this.#nodesById.entries()].map((e) => {
      const metadata = e[1].node.metadata;
      const jsonSchema = zodToJsonSchema(
        z.object({
          config: metadata.config,
          inputs: metadata.input,
          outputs: metadata.output,
        })
      ) as JsonSchema7ObjectType;
      const inputs = Object.entries(metadata.input._def.shape()).map(
        ([key, shape]: any[]) => {
          // @ts-expect-error
          const schema = jsonSchema.properties.inputs.properties[key];
          return {
            key,
            label: (shape._def.label as string) || key,
            schema,
            required:
              // @ts-expect-error
              jsonSchema.properties.inputs.required?.includes(key) || false,
          };
        }
      );
      const outputs = Object.entries(metadata.input._def.shape()).map(
        ([key, shape]: any[]) => {
          // @ts-expect-error
          const schema = jsonSchema.properties.inputs.properties[key];
          return {
            key,
            label: (shape._def.label as string) || key,
            schema,
            required:
              // @ts-expect-error
              jsonSchema.properties.inputs.required?.includes(key) || false,
          };
        }
      );

      return {
        id: e[0],
        label: e[1].options.label || metadata.name,
        inputs,
        outputs,
        hasUI: metadata.hasUI,
        type: pick(metadata, "id", "name"),
        dependencies: e[1].graphNode.dependencies,
      };
    });

    nodes.push({
      id: "@core/output",
      label: "Agent Output",
      inputs: [],
      outputs: [],
      hasUI: false,
      type: {
        id: "@core/output",
        name: "Agent output",
      },
      dependencies: Object.values(this.#outputBindings || {}).flatMap(
        (outputs) =>
          outputs.flatMap((o: any) => o[VALUE_PROVIDER]?.dependencies || [])
      ),
    });

    return {
      nodes,
    };
  }
}

export { GraphAgent };
