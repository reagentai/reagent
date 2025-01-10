import { createReagentNode, z } from "@reagentai/reagent/workflow";

const AgentError = createReagentNode({
  id: "@reagentai/react/agent-error",
  name: "Show Agent Error",
  version: "0.0.1",
  input: z.object({
    error: z.string().label("Error"),
  }),
  output: z.object({}),
  async *execute(context, input) {
    context.render(
      "error",
      (props) => <div className="text-red-700">Error: {props.data.error}</div>,
      {
        data: {
          error: input.error,
        },
      }
    );
  },
});

export { AgentError };
export const __reagentai_exports__ = true;
