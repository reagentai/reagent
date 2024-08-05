import { BaseReagentNodeOptions, StepStatus } from "@reagentai/reagent";
import { WorkflowClient } from "./types";

const executeNode = async (
  client: WorkflowClient,
  options: {
    session: {
      id: string;
    };
    node: BaseReagentNodeOptions<any, any, any>;
    input: any;
  }
) => {
  const { session, node, input } = options;
  const stepOutput = {};
  let isPending = false;
  const context = {
    node,
    session,
    config: {},
    PENDING: Symbol("__PENDING__"),
    done() {
      if (!isPending) {
        throw new Error("Calling 'done' isn't allowed form non PENDING step");
      }
      client.emit({
        sessionId: session.id,
        events: [],
        states: {
          [node.id]: {
            status: StepStatus.COMPLETED,
            output: stepOutput,
          },
        },
      });
    },
    render() {
      return {
        update() {
          throw new Error("update unsupported on client side execution");
        },
      };
    },
    sendOutput(output: any) {
      // send output only when node execution is completed or
      // 'done' is called for PENDING node
      Object.assign(stepOutput, output);
    },
  };

  const iterator = node.execute(context, input);
  let result = await iterator.next();
  while (!result.done) {
    Object.assign(stepOutput, result.value);
    result = await iterator.next();
  }

  const returnValue = result.value;
  if (returnValue == context.PENDING) {
    isPending = true;
  } else {
    client.emit({
      events: [],
      states: {
        [node.id]: {
          status: StepStatus.COMPLETED,
          output: stepOutput,
        },
      },
    });
  }
};

export { executeNode };
