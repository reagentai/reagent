import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";
import toposort from "toposort";
import { uniqBy } from "lodash-es";
import { includeKeys } from "filter-obj";

import { z } from "../core/zod.js";
import { WorkflowStepOptions, WorkflowStepRef } from "./WorkflowStep.js";
import { AbstractWorkflowNode } from "../core/node.js";
import { WorkflowStep } from "./WorkflowStep.js";
import { WorkflowRun, WorkflowRunOptions } from "./WorkflowRun.js";
import type { WorkflowOutputBindings } from "./types.js";
import {
  AbstractValueProvider,
  ValueProvider,
  WorkflowInputProvider,
  WorkflowToolProvider,
} from "./WorkflowStepOutput.js";
import { PublicEventType, EventType, WorkflowEvent } from "./types.js";
import { uniqueId } from "../../utils/uniqueId.js";

type WorkflowConfig = {
  name: string;
  description: string;
  replayBuffer?: number;
};

type AddNodeOptions<Config> = {
  config?: Config;
} & WorkflowStepOptions;

class InternalWorkflowRef {
  config: WorkflowConfig;
  nodesById: Map<string, WorkflowStepRef<any, any, any>>;
  // node dependency edges; [$dependency, $dependent]
  edges: [string, string][];
  // node ids sorted in topological order of dependency
  sortedNodeIds: string[];
  outputBindings?: WorkflowOutputBindings;
  subscriptions: Set<any>;
  constructor(config: WorkflowConfig) {
    this.config = config;
    this.nodesById = new Map();
    this.edges = [];
    this.sortedNodeIds = [];
    this.subscriptions = new Set();
  }

  addNodeRef(ref: WorkflowStepRef<any, any, any>) {
    this.nodesById.set(ref.nodeId, ref);
  }

  calculateNodeDependencies(nodeId: string) {
    const ref = this.nodesById.get(nodeId);
    if (!ref) {
      throw new Error("Invalid nodeId: " + nodeId);
    }
    const dependencies = Object.values(ref.bindings!).flatMap((provider) => {
      return provider.dependencies || [];
    });

    this.addNodeDependencies(
      nodeId,
      dependencies.map((dep: any) => dep.id)
    );
  }

  addNodeDependencies(nodeId: string, dependencyNodeIds: string[]) {
    dependencyNodeIds.forEach((dependency) => {
      this.edges.push([dependency, nodeId]);
    });
    this.edges = uniqBy(this.edges, ([nodeId, dep]) => nodeId + dep);
    // TODO: maybe remove this? was planning to run nodes in toplogical order
    // but that's not necessary for now. can do that later if perf becomes
    // an issue
    this.sortedNodeIds = toposort(this.edges);
  }

  // Dispatch events to the workflow
  // This will start a workflow run based on existing state
  // To start a new workflow, dispatch "INVOKE" event
  emit(options: WorkflowRunOptions<any>) {
    const sessionId = options.sessionId || uniqueId();
    const run = new WorkflowRun(this, {
      sessionId,
      ...includeKeys(options, ["input", "getStepState", "updateStepState"]),
    });

    for (const event of options.events) {
      if (event.type == PublicEventType.OUTPUT) {
        run.queueEvents({
          type: PublicEventType.OUTPUT,
          node: event.node,
          output: event.output,
        });
      } else if (event.type == PublicEventType.INVOKE) {
        run.queueEvents({
          type: PublicEventType.INVOKE,
          node: event.node,
          input: event.input,
        });
      } else if (event.type == PublicEventType.RUN_COMPLETED) {
        run.queueEvents({
          type: PublicEventType.RUN_COMPLETED,
          node: event.node,
        });
      } else {
        throw new Error("not implemented");
      }
    }

    // start the workflow
    run.queueEvents({
      // @ts-expect-error
      type: EventType.START,
      input: options.input,
    });
    return run;
  }
}

class Workflow<Input = undefined> {
  #ref;
  constructor(config: WorkflowConfig) {
    this.#ref = new InternalWorkflowRef(config);
  }

  get name() {
    return this.#ref.config.name;
  }

  get description() {
    return this.#ref.config.description;
  }

  get input(): WorkflowInputProvider<Input> {
    return new WorkflowInputProvider(this.#ref);
  }

  bind(bindings: WorkflowOutputBindings) {
    if (Boolean(this.#ref.outputBindings)) {
      throw new Error("Workflow outputs already bound!");
    }
    this.#ref.outputBindings = bindings;
  }

  getNode<
    Config extends Record<string, unknown> | void,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
  >(nodeId: string) {
    return this.#ref.nodesById.get(nodeId)?.step as
      | WorkflowStep<Config, Input, Output>
      | undefined;
  }

  addNode<
    Config extends void,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
  >(
    nodeId: string,
    node: AbstractWorkflowNode<Config, Input, Output>,
    options?: Omit<AddNodeOptions<Config>, "config">
  ): WorkflowStep<Config, Input, Output>;
  addNode<
    Config extends Record<string, unknown>,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
  >(
    nodeId: string,
    node: AbstractWorkflowNode<Config, Input, Output>,
    options: AddNodeOptions<Config>
  ): WorkflowStep<Config, Input, Output>;
  addNode<
    Config extends Record<string, unknown> | void,
    Input extends Record<string, unknown>,
    Output extends Record<string, unknown>,
  >(
    nodeId: string,
    node: AbstractWorkflowNode<Config, Input, Output>,
    options: AddNodeOptions<Config> = {}
  ) {
    if (this.#ref.nodesById.has(nodeId)) {
      throw new Error(`node with id [${nodeId}] already exists`);
    }
    const { config, ...opts } = options;
    const step = new WorkflowStep(
      this.#ref,
      nodeId,
      node,
      options?.config,
      opts
    );
    return step;
  }

  asTool(options: { id: string; nodeId: string; input: Record<string, any> }) {
    return new WorkflowToolProvider<any>(this.#ref, options);
  }

  invoke(
    event: Pick<WorkflowEvent.Invoke, "node" | "input">,
    options: Input extends undefined
      ? Omit<WorkflowRunOptions<Input>, "events" | "input"> | void
      : Omit<WorkflowRunOptions<Input>, "events">
  ) {
    return this.#ref.emit({
      ...options,
      input: (options as any).input || undefined,
      events: [
        {
          type: PublicEventType.INVOKE,
          node: event.node,
          input: event.input,
        },
      ],
    });
  }

  emit(options: WorkflowRunOptions<Input>) {
    return this.#ref.emit(options);
  }

  generateGraph() {
    const nodes = [...this.#ref.nodesById.entries()].map((e) => {
      const metadata = e[1].node.metadata;
      // @ts-expect-error
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
        type: includeKeys(metadata, ["id", "name"]),
        dependencies: e[1].dependencies,
      };
    });

    nodes.push({
      id: "@core/output",
      label: "Workflow Output",
      inputs: [],
      outputs: [],
      hasUI: false,
      type: {
        id: "@core/output",
        name: "Workflow output",
      },
      dependencies: Object.entries(this.#ref.outputBindings || {})
        .filter(([key]) => key != "data")
        .flatMap(([_, outputs]) =>
          (outputs as unknown as [string, ValueProvider<any>[]]).flatMap(
            (o: any) => {
              if (AbstractValueProvider.isValueProvider(o)) {
                return o.dependencies;
              }
              return [];
            }
          )
        ),
    });

    return {
      nodes,
    };
  }
}

export { Workflow, InternalWorkflowRef };
