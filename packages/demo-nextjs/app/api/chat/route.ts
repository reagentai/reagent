import { EventType, z } from "@reagentai/reagent";
import { OpenAI } from "@reagentai/reagent/llm/models";
import { triggerReagentWorkflow } from "@reagentai/serve";

import workflow from "../../workflow/workflow";

const invokeSchema = z.object({
  session: z
    .object({
      id: z.string().optional(),
    })
    .passthrough()
    .optional(),
  events: z.array(
    z
      .object({
        type: z.nativeEnum(EventType),
        node: z.object({
          id: z.string(),
        }),
        input: z.any(),
      })
      .passthrough()
  ),
  states: z.record(z.string(), z.any()).optional(),
});

export async function POST(request: Request) {
  const {
    session,
    events,
    states = {},
  } = invokeSchema.parse(await request.json());
  const workflowOutput = triggerReagentWorkflow(workflow, {
    sessionId: session?.id,
    // @ts-expect-error
    events,
    async getStepState(nodeId) {
      return states[nodeId];
    },
    updateStepState(node, state) {
      workflowOutput.next({
        type: "event",
        data: {
          type: "UPDATE_NODE_STATE",
          node,
          state,
        },
      });
    },
  });
  workflowOutput.task.toPromise().then(
    (e) => {
      console.log("DONE RESULT: ", e);
      // console.log("ERROR =", );
    },
    (e) => {
      console.log("DONE ERROR: ", e);
    }
  );
  return workflowOutput.toResponse();
}
