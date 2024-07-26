import { Workflow, lazy } from "@reagentai/reagent";
import {
  ChatCompletionWithToolCalling,
  WorkflowInput,
} from "@reagentai/reagent/nodes";
import { AgentError } from "@reagentai/react/tools/AgentError.js";

import { GetWeather } from "./Weather.js";

const workflow = new Workflow({
  name: "Weather app",
  description: "This agent shows random weather in Weather Widget",
});

const input = workflow.addNode("input", new WorkflowInput());
const error = workflow.addNode("error", new AgentError());

const chat1 = workflow.addNode("chat-1", new ChatCompletionWithToolCalling(), {
  config: {
    systemPrompt:
      "You are an amazing AI assistant called Jarvis who is very good at giving weather info.",
    temperature: 0.9,
    stream: true,
  },
});

const getWeather = workflow.addNode("weather", new GetWeather());

chat1.bind({
  model: input.output.model,
  query: input.output.query,
  tools: [
    getWeather.asTool({
      bind: {
        date: lazy(() => {
          return new Date().toISOString();
        }),
      },
      parameters: ["city", "country", "unit"],
    }),
  ],
});

error.bind({
  error: chat1.output.error,
});

workflow.bind({
  markdown: [chat1.output.markdown],
  markdownStream: [chat1.output.stream],
  ui: [getWeather.renderOutput, error.renderOutput],
});

export default workflow;
export const nodes = [GetWeather, AgentError];
export const __reagentai_exports__ = true;
