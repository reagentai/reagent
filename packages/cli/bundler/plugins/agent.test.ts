import { expect, test } from "vitest";
import { transformSync } from "@babel/core";
import generate from "@babel/generator";
// @ts-expect-error
import picomatch from "picomatch";

import { createRemoveExportsPlugin } from "./agent";

test("keep `nodes` export and used import", () => {
  const expected = `
  import {GetWeather} from "@reagentai/reagent/agent/nodes";
  export default "__removed_by_reagent__";
  export const nodes = [GetWeather];
  export const __reagentai_exports__ = true;
  `;

  const { code: transformedCode } = transform(`
  import { GraphAgent } from "@reagentai/reagent/agent";
  import {
    ChatInput,
    GetWeather
  } from "@reagentai/reagent/agent/nodes";
  
  const agent = new GraphAgent({
    name: "Weather app",
    description: "This agent shows random weather in Weather Widget",
  });
  
  const input = agent.addNode("input", new ChatInput());

  export default agent;
  export const nodes = [GetWeather];
  export const __reagentai_exports__ = true;
  `);
  expect(transformedCode).to.equal(cleanUpCode(expected));
});

test("only keep `nodes` export and used varaible", () => {
  const expected = `
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
  export default "__removed_by_reagent__";
  export const nodes = [GetWeather];
  export const __reagentai_exports__ = true;
  `;

  const { code: transformedCode } = transform(`
  import { GraphAgent } from "@reagentai/reagent/agent";
  import {
    ChatInput
  } from "@reagentai/reagent/agent/nodes";

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
  
  const agent = new GraphAgent({
    name: "Weather app",
    description: "This agent shows random weather in Weather Widget",
  });
  
  const input = agent.addNode("input", new ChatInput());

  export default agent;
  export const nodes = [GetWeather];
  export const __reagentai_exports__ = true;
  `);
  expect(transformedCode).to.equal(cleanUpCode(expected));
});

test("only keep used imports", () => {
  const expected = `
  import React from "react";
  const GetWeather = createAgentNode({
    async *execute(context, input) {
      React.test();
      yield { msg: "Hello" };
    },
  });
  export default "__removed_by_reagent__";
  export const nodes = [GetWeather];
  export const __reagentai_exports__ = true;
  `;

  // Note: need to use react import otherwise babel will remove for some reason
  const { code: transformedCode } = transform(`
  import { GraphAgent } from "@reagentai/reagent/agent";
  import { ChatInput } from "@reagentai/reagent/agent/nodes";
  import React from "react";

  const GetWeather = createAgentNode({
    async *execute(context, input) {
      React.test();
      yield { msg: "Hello" };
    },
  });

  const agent = new GraphAgent({
    name: "Weather app",
    description: "This agent shows random weather in Weather Widget",
  });

  const input = agent.addNode("input", new ChatInput());

  export default agent;
  export const nodes = [GetWeather];
  export const __reagentai_exports__ = true;
  `);
  expect(transformedCode).to.equal(cleanUpCode(expected));
});

test("test node_modules picomatch", () => {
  const matches = picomatch(["**/*"], {
    dot: true,
  });
  expect(matches("demo-cli/node_modules/.vite/rxjs.js")).toBe(true);
});

const removeExportsPlugin = createRemoveExportsPlugin({
  preserveExports: ["nodes"],
});

const transform = (code: string): { code: string } => {
  // @ts-expect-error
  return transformSync(code, {
    configFile: false,
    babelrc: false,
    filename: "test.tsx",
    plugins: [removeExportsPlugin, "@babel/plugin-syntax-jsx"],
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
    })?.ast!
  );
  return generated;
};
