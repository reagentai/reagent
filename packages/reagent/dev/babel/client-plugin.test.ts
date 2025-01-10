import { expect, test } from "vitest";
import { transformSync } from "@babel/core";
// @ts-ignore
import generate from "@babel/generator";

// @ts-ignore
import createBabelPlugin from "./index";

test("skip transpile if directive '@reagent-skip-transform' is found", () => {
  const codeToTransform = `
    "@reagent-skip-transform";
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
    });
  `;

  const { code: transformedCode } = transform(codeToTransform);
  expect(transformedCode).to.equal(cleanUpCode(codeToTransform));
});

test("dont transpile createReagentNode if it's not imported", () => {
  const expected = cleanUpCode(`
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1"
    };
  `);

  const { code: transformedCode } = transform(`
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
    });
  `);
  expect(transformedCode).not.to.equal(expected);
});

test("dont transpile createReagentNode if import doesn't match", () => {
  const codeToTransform = `import { createReagentNode, z } from "whatever";
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
  // since the code isn't transpiled, they should be same
  expect(transformedCode).equal(cleanUpCode(codeToTransform));
});

test("transpile createReagentNode if import matches", () => {
  const expected = cleanUpCode(`
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1"
    };  
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
        yield { msg: "Hello" };
      },
    });
  `);
  expect(transformedCode).toBe(expected);
});

test("extract only render calls from createReagentNode", () => {
  const expected = cleanUpCode(`
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1",
      components: [
        ["id-1", props => {
          return <div>FIRST</div>;
        }],
        ["id-2", props => {
          return <div>SECOND</div>;
        }]
      ]
    };
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
        const gen = context.render("id-1",
          (props) => {
            return <div>FIRST</div>;
          },
          {
            sql: input.sql,
          }
        );
        if (input.msg.length > 10) {
          context.render("id-2",
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

test("extract only render calls from createReagentNode when using variable", () => {
  const expected = cleanUpCode(`
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1",
      components: [
        ["id-1", props => <QueryComponent {...props.data} />]
      ]
    };
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
        const ui = context.render("id-1", (props) => <QueryComponent {...props.data} />, {
          sql: input.sql,
          result: [] as any[]
        });
        yield { msg: "Hello" };
      },
    });
  `);
  expect(transformedCode).toBe(expected);
});

test("leave execute method intact if target is client", () => {
  const expected = cleanUpCode(`
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1",
      target: "client",
      async *execute(context, input) {
        context.render("id-1", (props) => <div>NICE</div>);
        yield { msg: "Hello" };
      },
      components: [
        ["id-1", props => <div>NICE</div>]
      ]
    };
  `);

  const { code: transformedCode } = transform(`
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const GetWeather = createReagentNode({
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      description: "",
      version: "0.0.1",
      target: "client",
      input: z.object({
        msg: z.string()
      }),
      output: outputSchema,
      async *execute(context, input) {
        context.render("id-1", (props) => <div>NICE</div>);
        yield { msg: "Hello" };
      },
    });
  `);
  expect(transformedCode).toBe(expected);
});

test("transpile createReagentNode if import matches even if it's renamed", () => {
  const expected = cleanUpCode(`
    import { createReagentNode as createNode, z } from "@reagentai/reagent/agent";
    const GetWeather = {
      id: "@reagentai/demo-agents/getWeather",
      name: "Get weather",
      version: "0.0.1"
    };  
  `);

  const { code: transformedCode } = transform(`
    import { createReagentNode as createNode, z } from "@reagentai/reagent/agent";
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

// Note: typescript plugin removed unused import
test("don't transpile createReagentNode if imported scope doesn't match", () => {
  const expected = `
    import { z } from "@reagentai/reagent/agent";
    const createGetWeather = () => {
      const createReagentNode = () => {};
      return createReagentNode({
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

  const codeToTransform = `
    import { createReagentNode, z } from "@reagentai/reagent/agent";
    const createGetWeather = () => {
      const createReagentNode = () => {};
      return createReagentNode({
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
  expect(transformedCode).toBe(cleanUpCode(expected));
});

test("remove unnecessary fields from client side node", () => {
  const expected = `
  import { createReagentNode } from "@reagentai/reagent/agent";

  const FirstStep = {
    id: "step-1",
    name: "Step One",
    version: "0.0.1"
  };
  `;

  // Note: need to use react import otherwise babel will remove for some reason
  const { code: transformedCode } = transform(`
  import { createReagentNode, z } from "@reagentai/reagent/agent";

  const FirstStep = createReagentNode({
    id: "step-1",
    name: "Step One",
    description: "Description for step 1",
    version: "0.0.1",
    async *execute(context, input) {
      console.log("STEP 1");
      yield { done: true };
    },
  });
  `);
  expect(transformedCode).to.equal(cleanUpCode(expected));
});

const plugin = createBabelPlugin({
  ssr: false,
});
const transform = (code: string): { code: string } => {
  // @ts-expect-error
  return transformSync(code, {
    configFile: false,
    babelrc: false,
    filename: "test.tsx",
    plugins: [plugin, "@babel/plugin-syntax-jsx"],
    presets: ["@babel/preset-typescript"],
    sourceMaps: false,
  });
};

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
