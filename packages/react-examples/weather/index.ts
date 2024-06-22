import { GraphAgent } from "@reagentai/reagent/agent/index.js";
import {
  ChatCompletionWithToolCalling,
  ChatInput,
} from "@reagentai/reagent/agent/nodes/index.js";
import { AgentError } from "@reagentai/react/tools/AgentError.js";

import { GetWeather } from "./Weather.js";

const agent = new GraphAgent({
  name: "Weather app",
  description: "This agent shows random weather in Weather Widget",
});

const input = agent.addNode("input", new ChatInput());
const error = agent.addNode("error", new AgentError());

const chat1 = agent.addNode("chat-1", new ChatCompletionWithToolCalling(), {
  config: {
    systemPrompt: "You are an amazing AI assistant called Jarvis",
    temperature: 0.9,
    stream: true,
  },
});

const getWeather = agent.addNode("weather", new GetWeather());

chat1.bind({
  model: input.output.model,
  query: input.output.query,
  tools: [getWeather.schema],
});

error.bind({
  error: chat1.output.error,
});

agent.bind({
  markdown: [chat1.output.markdown],
  markdownStream: [chat1.output.stream],
  ui: [getWeather.renderOutput, error.renderOutput],
});

export default agent;
export const nodes = [GetWeather, AgentError];
export const __reagentai_exports__ = true;
