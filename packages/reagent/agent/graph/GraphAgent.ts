import { Observer, Subscription } from "rxjs";

import { GraphNode } from "./GraphNode";
import { AbstractAgentNode } from "../node";
import { EventStream } from "../stream";
import { pick } from "lodash-es";

type AgentConfig = {
  name: string;
  description: string;
  replayBuffer?: number;
};

class GraphAgent {
  #config: AgentConfig;
  #nodesById: Map<string, GraphNode<any, any, any, any>>;
  #stream: EventStream<any>;
  constructor(config: AgentConfig) {
    this.#config = config;
    this.#stream = new EventStream();
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
    return this.#nodesById.get(nodeId) as
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
    node: AbstractAgentNode<Config, Input, Output, State>
  ): GraphNode<Config, Input, Output, State>;
  addNode<
    Config extends Record<string, unknown>,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
    State extends Record<string, unknown> = {},
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    config: Config
  ): GraphNode<Config, Input, Output, State>;
  addNode<
    Config extends Record<string, unknown> | void,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
    State extends Record<string, unknown> = {},
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    config?: Config
  ) {
    if (this.#nodesById.has(nodeId)) {
      throw new Error(`node with id [${nodeId}] already exists`);
    }
    const graphNode = new GraphNode(nodeId, node, config, this.#stream);
    this.#nodesById.set(nodeId, graphNode);
    return graphNode;
  }

  generateGraph() {
    return [...this.#nodesById.entries()].map((e) => {
      return {
        id: e[0],
        node: pick(e[1].node, "id", "name"),
        dependencies: e[1].dependencies,
      };
    });
  }
}

export { GraphAgent };
