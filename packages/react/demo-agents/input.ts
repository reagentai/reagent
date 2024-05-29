import { z } from "@useportal/reagent/agent";
import { Passthrough } from "@useportal/reagent/agent/nodes";
import { BaseModelProvider } from "@useportal/reagent/llm/models";

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
