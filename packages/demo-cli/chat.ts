import { GraphAgent } from "@reagentai/reagent/agent";
import {
  ChatCompletion,
  ChatInput,
  User,
} from "@reagentai/reagent/agent/nodes";
import { Groq } from "@reagentai/reagent/llm/integrations/models";

const agent = new GraphAgent({
  name: "Simple AI Chat",
  description: "A simple AI chat agent.",
});

const input = agent.addNode("input", new ChatInput());

const chat1 = agent.addNode("chat-1", new ChatCompletion(), {
  config: {
    systemPrompt: "You are an amazing AI assistant called Jarvis",
    temperature: 0.9,
    stream: true,
  },
});

const user = agent.addNode("user", new User());

chat1.bind({
  model: new Groq({ model: "llama3-8b-8192" }),
  query: input.output.query,
});

user.bind({
  markdown: chat1.output.markdown,
  markdownStream: chat1.output.stream,
});

export default agent;
export const nodes = [];
