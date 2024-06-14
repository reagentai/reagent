import { createReagentNode, z } from "@reagentai/reagent/agent/index.js";
import {
  CodeInterpreter as E2BCodeInterpreter,
  Execution,
} from "@e2b/code-interpreter";

import {
  CodeInterpreterComponent,
  CodeInterpreterData,
} from "./CodeInterpreter.js";

const outputSchema = z.object({});

const CodeInterpreter = createReagentNode({
  id: "@e2b/execute_python",
  name: "E2B - Code interpreter",
  description: `Execute python code in a Jupyter notebook cell and returns any result, stdout, stderr, display_data, and error.`,
  version: "0.0.1",
  input: z.object({
    code: z.string().describe("The python code to execute in a single cell."),
  }),
  output: outputSchema,
  async *execute(context, input) {
    const render = context.render(
      (props) => <CodeInterpreterComponent {...props} />,
      {
        code: input.code,
      } as CodeInterpreterData
    );

    const codeInterpreter = await E2BCodeInterpreter.create();
    const exec = await codeInterpreter.notebook.execCell(input.code);

    render.update({
      code: input.code,
      results: exec.results,
      logs: exec.logs,
      error: exec.error,
    });
  },
});

export const __reagentai_exports__ = true;
export { CodeInterpreter };
