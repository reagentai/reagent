import { expect, test } from "vitest";
import { transformSync } from "@babel/core";
// @ts-ignore
import generate from "@babel/generator";

// @ts-ignore
import createBabelPlugin from "./index";

const plugin = createBabelPlugin({
  ssr: false,
});

test("skip transpile if directive '@reagent-skip-transform' is found", () => {
  const codeToTransform = `
    "@reagent-skip-transform";
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
    });
  `;

  const { code: transformedCode } = transform(codeToTransform);
  expect(transformedCode).to.equal(cleanUpCode(codeToTransform));
});

test("dont transpile createAgentNode if it's not imported", () => {
  const expected = cleanUpCode(`
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1",
      *execute(context, input) {}
    };
  `);

  const { code: transformedCode } = transform(`
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
    });
  `);
  expect(transformedCode).not.to.equal(expected);
});

test("dont transpile createAgentNode if import doesn't match", () => {
  const codeToTransform = `import { createAgentNode, z } from "whatever";
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
  // since the code isn't transpiled, they should be same
  expect(transformedCode).equal(cleanUpCode(codeToTransform));
});

test("transpile createAgentNode if import matches", () => {
  const expected = cleanUpCode(`
    import { createAgentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1",
      *execute(context, input) {}
    };  
  `);

  const { code: transformedCode } = transform(`
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
    });
  `);
  expect(transformedCode).toBe(expected);
});

test("transpile createAgentNode if import matches even if it's renamed", () => {
  const expected = cleanUpCode(`
    import { createAgentNode as createNode, z } from "@reagentai/reagent/agent";
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1",
      *execute(context, input) {}
    };  
  `);

  const { code: transformedCode } = transform(`
    import { createAgentNode as createNode, z } from "@reagentai/reagent/agent";
    const GetWeather = createNode({
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
    });
  `);
  expect(transformedCode).toBe(expected);
});

test("don't transpile createAgentNode if imported scope doesn't match", () => {
  const codeToTransform = `
    import { createAgentNode, z } from "@reagentai/reagent/agent";
    const createGetWeather = () => {
      const createAgentNode = () => {};
      return createAgentNode({
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
      });
    }`;

  const { code: transformedCode } = transform(codeToTransform);
  // console.log(transformedCode)
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
