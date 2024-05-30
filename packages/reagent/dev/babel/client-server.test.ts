import { expect, test } from "vitest";
import { transformSync } from "@babel/core";
// @ts-ignore
import generate from "@babel/generator";

// @ts-ignore
import createBabelPlugin from "./index";

const plugin = createBabelPlugin({
  ssr: true,
});

test("dont transpile createAgentNode in server if no render is used", () => {
  const codeToTransform = `
    import { createAgentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = createAgentNode({
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      description: "",
      version: "0.0.1",
      input: z.object({
        msg: z.string()
      }),
      output: outputSchema,
      async *execute(context, input) {
        yield { msg: "Hello" };
      },
    });`;

  const { code: transformedCode } = transform(codeToTransform);
  expect(transformedCode).toBe(cleanUpCode(codeToTransform));
});

const transform = (code: string): { code: string } => {
  // @ts-expect-error
  return transformSync(code, {
    configFile: false,
    babelrc: false,
    plugins: [plugin],
    sourceMaps: false,
  });
};

const cleanUpCode = (code: string) => {
  const { code: generated } = generate(
    transformSync(code, {
      ast: true,
    })?.ast
  );
  return generated;
};
