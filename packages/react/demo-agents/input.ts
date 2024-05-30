import { z } from "@reagentai/reagent/agent";
import { Passthrough } from "@reagentai/reagent/agent/nodes";
import { BaseModelProvider } from "@reagentai/reagent/llm/models";

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
