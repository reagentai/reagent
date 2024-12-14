import {
  Context,
  NodeMetadata,
  StepStatus,
} from "@reagentai/reagent/workflow/client";
import { dset } from "dset/merge";

import { ExecutionClient, WorkflowClientOptions } from "./types";

const executeNode = async (
  client: Pick<ExecutionClient, "send">,
  options: {
    session: {
      id: string;
    };
    node: NodeMetadata;
    template: WorkflowClientOptions["templates"][number];
    input: any;
  }
) => {
  return await new Promise(async (resolve) => {
    const { session, node, template, input } = options;
    const stepOutput = {};
    let isPending = false;
    const completeStep = () => {
      const states = {};

      const path = node.path || [];
      path.push(node.id);

      dset(states, path, {
        "@@status": StepStatus.COMPLETED,
        "@@data": {
          output: stepOutput,
        },
      });

      const res = client.send({
        session,
        events: [],
        states,
      });
      res.subscribe({
        complete() {
          resolve(null);
        },
        error() {
          resolve(null);
        },
      });
    };
    const context = {
      node,
      session,
      config: {},
      PENDING: Symbol("__PENDING__"),
      TASK: Symbol("__TASK__"),
      getState() {
        throw new Error("unsupported");
      },
      setState() {
        throw new Error("unsupported");
      },
      emit() {
        throw new Error("unsupported");
      },
      stop() {
        throw new Error("unsupported");
      },
      done() {
        if (!isPending) {
          throw new Error("Calling 'done' isn't allowed form non PENDING step");
        }
        completeStep();
      },
      render() {
        return {
          update() {
            throw new Error("update unsupported on client side execution");
          },
        };
      },
      prompt() {
        throw new Error("unsupported");
      },
      step() {
        throw new Error("unsupported");
      },
      steps() {
        throw new Error("unsupported");
      },
      sendOutput(output: any) {
        // send output only when node execution is completed or
        // 'done' is called for PENDING node
        Object.assign(stepOutput, output);
      },
      task(_generator, ...args) {
        throw new Error("unsupported");
      },
    } satisfies Context<any, any>;

    const iterator = template.execute(context, input);
    let result = await iterator.next();
    while (!result.done) {
      Object.assign(stepOutput, result.value);
      result = await iterator.next();
    }

    const returnValue = result.value;
    if (returnValue == context.PENDING) {
      isPending = true;
    } else {
      completeStep();
    }
  });
};

export { executeNode };
