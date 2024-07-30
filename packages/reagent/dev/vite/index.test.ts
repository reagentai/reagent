import { expect, test } from "vitest";
import { transformSync } from "@babel/core";
// @ts-ignore
import generate from "@babel/generator";

import createVitePlugin from "./plugin.js";

const vitePlugin = createVitePlugin({
  plugins: ["@babel/plugin-syntax-jsx"],
  presets: [
    [
      "@babel/preset-typescript",
      {
        allowDeclareFields: true,
      },
    ],
  ],
});

test("test vite plugin - should remove default export", () => {
  const expected = cleanUpCode(`const FirstStep = {
    id: "step-1",
    name: "Step One",
    version: "0.0.1",
    target: "client",
    async *execute(context, input) {
        console.log("STEP 1");
        yield { done: true };
    },
    };

    export default "__removed_by_reagent__";
    export const nodes = [FirstStep];
    export const __reagentai_exports__ = true;`);

  const source = `import { Workflow } from "@reagentai/reagent";
    import { createReagentNode, z } from "@reagentai/reagent/workflow.js";

    const FirstStep = createReagentNode({
    id: "step-1",
    name: "Step One",
    description: "Description for step 1",
    version: "0.0.1",
    input: z.object({}),
    target: "client",
    output: z.object({
        done: z.boolean(),
    }),
    async *execute(context, input) {
        console.log("STEP 1");
        yield { done: true };
    },
    });

    const workflow = new Workflow({
    name: "Client side workflow",
    description: "This workflow is meant to run on the client side",
    });

    const step1 = workflow.addNode("step-1", new FirstStep());

    workflow.bind({
        data: [step1.output.done]
    });

    export default workflow;
    export const nodes = [FirstStep];
    export const __reagentai_exports__ = true;`;

  const { code } = vitePlugin.transform(source, "file.tsx", {
    ssr: false,
  })!;
  expect(code).to.equal(expected);
});

const cleanUpCode = (code: string) => {
  const { code: generated } = generate(
    transformSync(code, {
      filename: "test.tsx",
      ast: true,
      plugins: ["@babel/plugin-syntax-jsx"],
    })?.ast
  );
  return generated;
};
