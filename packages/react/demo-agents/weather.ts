import { GraphAgent, mergeRenderStreams } from "@reagentai/reagent/agent";
import {
  ChatCompletionWithToolCalling,
  User,
  ChatInput,
} from "@reagentai/reagent/agent/nodes";

import { GetWeather } from "./tools/Weather.js";
import { AgentError } from "./tools/AgentError.js";

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

const user = agent.addNode("user", new User());

const getWeather = agent.addNode("weather", new GetWeather());

chat1.bind({
  model: input.output.model,
  query: input.output.query,
  tools: [getWeather.schema],
});

error.bind({
  error: chat1.output.error,
});

user.bind({
  markdown: chat1.output.markdown,
  markdownStream: chat1.output.stream,
  ui: mergeRenderStreams(getWeather.render, error.render),
});

export default agent;
export const nodes = [GetWeather];
export const __reagentai_exports__ = true;
