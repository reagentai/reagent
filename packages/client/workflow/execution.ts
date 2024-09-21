import {
  NodeMetadata,
  BaseReagentNodeOptions,
  StepStatus,
} from "@reagentai/reagent/workflow/client";
import { dset } from "dset/merge";

import { ExecutionClient } from "./types";

const executeNode = async (
  client: ExecutionClient,
  options: {
    session: {
      id: string;
    };
    node: NodeMetadata;
    template: BaseReagentNodeOptions<any, any, any>;
    input: any;
  }
) => {
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

    client.send({
      session,
      events: [],
      states,
    });
  };
  const context = {
    node,
    session,
    config: {},
    state: undefined,
    PENDING: Symbol("__PENDING__"),
    updateState() {
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
    sendOutput(output: any) {
      // send output only when node execution is completed or
      // 'done' is called for PENDING node
      Object.assign(stepOutput, output);
    },
  };

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
};

export { executeNode };
