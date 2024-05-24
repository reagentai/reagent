import { Observer, ReplaySubject, Subscription, mergeMap } from "rxjs";

import { GraphNode } from "./GraphNode";
import { AbstractAgentNode } from "./node";
import { EventStream } from "./stream";

type AgentConfig = {
  replayBuffer?: number;
};

class GraphAgent {
  #config: AgentConfig;
  #nodesById: Map<string, GraphNode<any, any, any, any>>;
  #nodeStream: ReplaySubject<any>;
  constructor(config: AgentConfig = {}) {
    this.#config = config;
    this.#nodeStream = new ReplaySubject();
    this.#nodesById = new Map();
  }

  subscribe(
    callback: Partial<Observer<any>> | ((value: any) => void)
  ): Subscription {
    return this.#nodeStream
      .pipe(mergeMap((stream) => stream))
      .subscribe(callback);
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
    const stream = new EventStream();
    this.#nodeStream.next(stream);
    const graphNode = new GraphNode(nodeId, node, config, stream as any);
    this.#nodesById.set(nodeId, graphNode);
    return graphNode;
  }
}

export { GraphAgent };
