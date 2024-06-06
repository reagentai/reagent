import { Observer, Subscription } from "rxjs";
import { pick } from "lodash-es";

import { GraphNode } from "./GraphNode.js";
import { AbstractAgentNode } from "../node.js";
import { EventStream } from "../stream.js";

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
    return {
      nodes: [...this.#nodesById.entries()].map((e) => {
        return {
          id: e[0],
          label: e[1].options.label || e[1].node.metadata.name,
          type: pick(e[1].node.metadata, "id", "name"),
          dependencies: e[1].graphNode.dependencies,
        };
      }),
    };
  }
}

export { GraphAgent };
