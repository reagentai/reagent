import { ReplaySubject, mergeMap } from "rxjs";

import { z } from "./zod";
import { GraphNode } from "./GraphNode";
import { AbstractAgentNode, EmptyAgentState } from "./node";
import { EventStream } from "./stream";
import { ZodObjectSchema } from "./types";

class AgentExecutor {
  #nodeStream: ReplaySubject<any>;
  constructor() {
    this.#nodeStream = new ReplaySubject();
  }

  subscribe(callback: (data: any) => void) {
    this.#nodeStream.pipe(mergeMap((stream) => stream)).subscribe(callback);
  }

  addNode<
    Config extends z.ZodVoid,
    Input extends ZodObjectSchema,
    Output extends ZodObjectSchema,
    State extends ZodObjectSchema = EmptyAgentState,
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>
  ): GraphNode<Config, Input, Output, State>;
  addNode<
    Config extends ZodObjectSchema,
    Input extends ZodObjectSchema,
    Output extends ZodObjectSchema,
    State extends ZodObjectSchema = EmptyAgentState,
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    config: z.infer<Config>
  ): GraphNode<Config, Input, Output, State>;
  addNode<
    Config extends ZodObjectSchema | z.ZodVoid,
    Input extends ZodObjectSchema,
    Output extends ZodObjectSchema,
    State extends ZodObjectSchema = EmptyAgentState,
  >(
    nodeId: string,
    node: AbstractAgentNode<Config, Input, Output, State>,
    config?: z.infer<Config>
  ) {
    const stream = new EventStream();
    this.#nodeStream.next(stream);
    return new GraphNode(nodeId, node, config, stream as any);
  }
}

export { AgentExecutor };
