import { z } from "@reagentai/reagent/agent";
import { Passthrough } from "@reagentai/reagent/agent/nodes";
import { BaseModelProvider } from "@reagentai/reagent/llm/models";

const createChatInputNode = () =>
  new Passthrough(
    z.object({
      query: z.string(),
      model: z.instanceof(BaseModelProvider),
    })
  );

export { createChatInputNode };
export type ChatInput = z.infer<
  ReturnType<typeof createChatInputNode>["metadata"]["output"]
>;
