import { EventType, z } from "@reagentai/reagent";
import { OpenAI } from "@reagentai/reagent/llm/models";
import { triggerReagentWorkflow } from "@reagentai/serve";
import workflow from "../../workflow/workflow";

const invokeSchema = z.object({
  sessionId: z.string().optional(),
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
    sessionId,
    events,
    states = {},
  } = invokeSchema.parse(await request.json());
  const model = new OpenAI({
    model: "gpt-3.5-turbo",
  });

  const workflowOutput = triggerReagentWorkflow(workflow, {
    sessionId,
    // @ts-expect-error
    events,
    async getStepState(nodeId) {
      return states[nodeId];
    },
    updateStepState(nodeId, state) {
      workflowOutput.next({
        type: "event",
        data: {
          type: "UPDATE_NODE_STATE",
          node: { id: nodeId },
          state,
        },
      });
    },
  });
  return workflowOutput.toResponse();
}
