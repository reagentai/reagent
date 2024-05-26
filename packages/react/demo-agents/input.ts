import { z } from "@portal/reagent/agent";
import { Passthrough } from "@portal/reagent/agent/nodes";
import { BaseModelProvider } from "@portal/reagent/llm/models";

const createInputNode = () =>
  new Passthrough(
    z.object({
      query: z.string(),
      model: z.instanceof(BaseModelProvider),
    })
  );

export { createInputNode };
export type Input = z.infer<
  ReturnType<typeof createInputNode>["metadata"]["output"]
>;
