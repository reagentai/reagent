// import { pick, uniqBy } from "lodash-es";
// import zodToJsonSchema, { JsonSchema7ObjectType } from "zod-to-json-schema";
// import toposort from "toposort";

// import { z } from "../zod.js";
// import { WorkflowStepOptions, WorkflowStepRef } from "./WorkflowStep.js";
// import { AbstractWorkflowNode } from "./node.js";
// import { WorkflowStep } from "./WorkflowStep.js";
// import { WorkflowRun } from "./WorkflowRun.js";
// import type { WorkflowOutputBindings } from "./types.js";
// import { AbstractValueProvider } from "./WorkflowStepOutput.js";

// type WorkflowConfig = {
//   name: string;
//   description: string;
//   replayBuffer?: number;
// };

// type AddNodeOptions<Config> = {
//   config?: Config;
// } & WorkflowStepOptions;

// class InternalWorkflowRef {
//   config: WorkflowConfig;
//   nodesById: Map<string, WorkflowStepRef<any, any, any>>;
//   // node dependency edges; [$dependency, $dependent]
//   edges: [string, string][];
//   // node ids sorted in topological order of dependency
//   sortedNodeIds: string[];
//   constructor(config: WorkflowConfig) {
//     this.config = config;
//     this.nodesById = new Map();
//     this.edges = [];
//     this.sortedNodeIds = [];
//   }

//   addNodeRef(ref: WorkflowStepRef<any, any, any>) {
//     this.nodesById.set(ref.nodeId, ref);
//   }

//   calculateNodeDependencies(nodeId: string) {
//     const ref = this.nodesById.get(nodeId);
//     if (!ref) {
//       throw new Error("Invalid nodeId: " + nodeId);
//     }
//     const dependencies = Object.values(ref.bindings!).flatMap((provider) => {
//       return provider.dependencies || [];
//     });

//     this.addNodeDependencies(
//       nodeId,
//       dependencies.map((dep: any) => dep.id)
//     );
//   }

//   addNodeDependencies(nodeId: string, dependencyNodeIds: string[]) {
//     dependencyNodeIds.forEach((dependency) => {
//       this.edges.push([dependency, nodeId]);
//     });
//     this.edges = uniqBy(this.edges, ([nodeId, dep]) => nodeId + dep);
//     this.sortedNodeIds = toposort(this.edges);
//   }
// }

// class Workflow {
//   #outputBindings?: WorkflowOutputBindings;
//   #ref;
//   constructor(config: WorkflowConfig) {
//     this.#ref = new InternalWorkflowRef(config);
//   }

//   get name() {
//     return this.#ref.config.name;
//   }

//   get description() {
//     return this.#ref.config.description;
//   }

//   bind(bindings: WorkflowOutputBindings) {
//     if (Boolean(this.#outputBindings)) {
//       throw new Error("Workflow outputs already bound!");
//     }
//     this.#outputBindings = bindings;
//   }

//   getNode<
//     Config extends Record<string, unknown> | void,
//     Input extends Record<string, unknown>,
//     Output extends Record<string, unknown>
//   >(nodeId: string) {
//     return this.#ref.nodesById.get(nodeId)?.step as
//       | WorkflowStep<Config, Input, Output>
//       | undefined;
//   }

//   addNode<
//     Config extends void,
//     Input extends Record<string, unknown>,
//     Output extends Record<string, unknown>
//   >(
//     nodeId: string,
//     node: AbstractWorkflowNode<Config, Input, Output>,
//     options?: Omit<AddNodeOptions<Config>, "config">
//   ): WorkflowStep<Config, Input, Output>;
//   addNode<
//     Config extends Record<string, unknown>,
//     Input extends Record<string, unknown>,
//     Output extends Record<string, unknown>
//   >(
//     nodeId: string,
//     node: AbstractWorkflowNode<Config, Input, Output>,
//     options: AddNodeOptions<Config>
//   ): WorkflowStep<Config, Input, Output>;
//   addNode<
//     Config extends Record<string, unknown> | void,
//     Input extends Record<string, unknown>,
//     Output extends Record<string, unknown>
//   >(
//     nodeId: string,
//     node: AbstractWorkflowNode<Config, Input, Output>,
//     options: AddNodeOptions<Config> = {}
//   ) {
//     if (this.#ref.nodesById.has(nodeId)) {
//       throw new Error(`node with id [${nodeId}] already exists`);
//     }
//     const { config, ...opts } = options;
//     const step = new WorkflowStep(
//       this.#ref,
//       nodeId,
//       node,
//       options?.config,
//       opts
//     );
//     return step;
//   }

//   run<Input>(options: { nodeId: string; input: Input }) {
//     const run = new WorkflowRun(
//       this.#ref.nodesById,
//       this.#outputBindings as any
//     );
//     run.start();
//     run.invoke(options);
//     return run;
//   }

//   generateGraph() {
//     const nodes = [...this.#ref.nodesById.entries()].map((e) => {
//       const metadata = e[1].node.metadata;
//       const jsonSchema = zodToJsonSchema(
//         z.object({
//           config: metadata.config,
//           inputs: metadata.input,
//           outputs: metadata.output,
//         })
//       ) as JsonSchema7ObjectType;
//       const inputs = Object.entries(metadata.input._def.shape()).map(
//         ([key, shape]: any[]) => {
//           // @ts-expect-error
//           const schema = jsonSchema.properties.inputs.properties[key];
//           return {
//             key,
//             label: (shape._def.label as string) || key,
//             schema,
//             required:
//               // @ts-expect-error
//               jsonSchema.properties.inputs.required?.includes(key) || false,
//           };
//         }
//       );
//       const outputs = Object.entries(metadata.input._def.shape()).map(
//         ([key, shape]: any[]) => {
//           // @ts-expect-error
//           const schema = jsonSchema.properties.inputs.properties[key];
//           return {
//             key,
//             label: (shape._def.label as string) || key,
//             schema,
//             required:
//               // @ts-expect-error
//               jsonSchema.properties.inputs.required?.includes(key) || false,
//           };
//         }
//       );

//       return {
//         id: e[0],
//         label: e[1].options.label || metadata.name,
//         inputs,
//         outputs,
//         hasUI: metadata.hasUI,
//         type: pick(metadata, "id", "name"),
//         dependencies: e[1].dependencies,
//       };
//     });

//     nodes.push({
//       id: "@core/output",
//       label: "Workflow Output",
//       inputs: [],
//       outputs: [],
//       hasUI: false,
//       type: {
//         id: "@core/output",
//         name: "Workflow output",
//       },
//       dependencies: Object.values(this.#outputBindings || {}).flatMap(
//         (outputs) =>
//           outputs.flatMap((o: any) => {
//             if (AbstractValueProvider.isValueProvider(o)) {
//               return o.dependencies;
//             }
//             return [];
//           })
//       ),
//     });

//     return {
//       nodes,
//     };
//   }
// }

// export { Workflow, InternalWorkflowRef };
