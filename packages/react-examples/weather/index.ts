import { Workflow } from "@reagentai/reagent";
import {
  ChatCompletionWithToolCalling,
  ChatInput,
} from "@reagentai/reagent/nodes";
import { AgentError } from "@reagentai/react/tools/AgentError.js";

import { GetWeather } from "./Weather.js";
import { DummyModel } from "@reagentai/reagent/llm/models/index.js";

const workflow = new Workflow({
  name: "Weather app",
  description: "This agent shows random weather in Weather Widget",
});

const input = workflow.addNode("input", new ChatInput());
const error = workflow.addNode("error", new AgentError());

const chat1 = workflow.addNode("chat-1", new ChatCompletionWithToolCalling(), {
  config: {
    systemPrompt:
      "You are an amazing AI assistant called Jarvis who is very good at giving weather info.",
    temperature: 0.9,
    stream: true,
  },
});

const chat2 = workflow.addNode("chat-2", new ChatCompletionWithToolCalling(), {
  config: {
    systemPrompt:
      "You are an amazing AI assistant called Jarvis who is very good at giving weather info.",
    temperature: 0.9,
    stream: true,
  },
});

const getWeather = workflow.addNode("weather", new GetWeather());

chat1.bind({
  // model: input.output.model,
  model: new DummyModel({
    response: { content: "This is the weather channel: " },
  }),
  query: input.output.query,
  tools: [
    // getWeather.asTool({
    //   bind: {
    //     date: input.output.query,
    //   },
    //   parameters: ["city", "country", "unit"],
    // }),
  ],
});

chat2.bind({
  // model: getWeather.output.conditions.map((c) => {
  //   return new DummyModel({
  //     response: { content: "This is the weather channel: " + c },
  //   });
  // }),
  model: input.output.model,
  // query: chat1.output.markdown,
  query: input.output.query,
  tools: [
    // getWeather.asTool({
    //   bind: {
    //     date: input.output.query,
    //   },
    //   parameters: ["city", "country", "unit"],
    // }),
  ],
});

error.bind({
  error: chat1.output.error,
});

// getWeather.bind( {})

workflow.bind({
  markdown: [chat1.output.markdown, chat2.output.markdown],
  // markdown: [chat1.output.markdown],
  markdownStream: [chat1.output.stream],
  // ui: [getWeather.renderOutput, error.renderOutput],
});

// getWeather.renderOutput.subscribe((x) => {
//   console.log("RENDER OUTPUT =", x);
// });

const run = workflow.run({
  nodeId: "input",
  input: {
    query: "Hello there",
    model: new DummyModel({
      response: { content: "I am AI" },
      // response: {
      //   tool_call: {
      //     name: "reagentai_react_examples_get_weather",
      //     arguments: "{}",
      //   },
      // },
    }),
  },
});

run.output.markdown.subscribe((x) => {
  console.log("markdown =", x);
});

run.output.ui.subscribe((x) => {
  console.log("UI =", x);
});

// console.log("task runnign =", run.task.isRunning());
console.log("task runnign =", await run.task.toPromise());

export default workflow;
export const nodes = [GetWeather, AgentError];
export const __reagentai_exports__ = true;
