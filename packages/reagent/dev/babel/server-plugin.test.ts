import { expect, test } from "vitest";
import { transformSync } from "@babel/core";
// @ts-ignore
import generate from "@babel/generator";

// @ts-ignore
import createBabelPlugin from "./index";

const plugin = createBabelPlugin({
  ssr: true,
});

test("dont transpile createReagentNode in server if no render is used", () => {
  const codeToTransform = `
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = createReagentNode({
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

test("add component-id to nested render calls", () => {
  const expected = cleanUpCode(`
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = createReagentNode({
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      description: "",
      version: "0.0.1",
      input: z.object({
        msg: z.string()
      }),
      output: outputSchema,
      async *execute(context, input) {
        const gen = context.render("component-0",
          {
            sql: input.sql,
          }
        );
        if (input.msg.length > 10) {
          context.render("component-1");
        }
        yield { msg: "Hello" };
      },
      hasUI: true
    });
  `);

  const { code: transformedCode } = transform(`
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = createReagentNode({
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      description: "",
      version: "0.0.1",
      input: z.object({
        msg: z.string()
      }),
      output: outputSchema,
      async *execute(context, input) {
        const gen = context.render(
          (props) => {
            return <div>FIRST</div>;
          },
          {
            sql: input.sql,
          }
        );
        if (input.msg.length > 10) {
          context.render(
            (props) => {
              return <div>SECOND</div>;
            }
          );
        }
        yield { msg: "Hello" };
      },
    });
  `);
  expect(transformedCode).toBe(expected);
});

const transform = (code: string): { code: string } => {
  // @ts-expect-error
  return transformSync(code, {
    configFile: false,
    babelrc: false,
    plugins: [plugin, "@babel/plugin-syntax-jsx"],
    sourceMaps: false,
  });
};

const cleanUpCode = (code: string) => {
  const { code: generated } = generate(
    transformSync(code, {
      ast: true,
      plugins: ["@babel/plugin-syntax-jsx"],
    })?.ast
  );
  return generated;
};
