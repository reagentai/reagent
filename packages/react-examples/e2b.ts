import { GraphAgent } from "@reagentai/reagent/agent/index.js";
import {
  ChatCompletionWithToolCalling,
  ChatInput,
} from "@reagentai/reagent/agent/nodes/index.js";
import { AgentError } from "@reagentai/react/tools/AgentError.js";
import { CodeInterpreter } from "@reagentai/thirdparty/e2b/index.js";

const agent = new GraphAgent({
  name: "E2B data analysis agent",
  description: "This is a demo code interpreter agent using E2B",
});

const input = agent.addNode("input", new ChatInput());
const error = agent.addNode("error", new AgentError());

const chat1 = agent.addNode("chat-1", new ChatCompletionWithToolCalling(), {
  config: {
    systemPrompt: "You are an amazing AI assistant",
    temperature: 0.9,
    stream: true,
  },
});

const codeInterpreter = agent.addNode(
  "code-interpreter",
  new CodeInterpreter()
);

chat1.bind({
  model: input.output.model,
  query: input.output.query,
  tools: [codeInterpreter.schema],
});

error.bind({
  error: chat1.output.error,
});

agent.bind({
  markdown: [chat1.output.markdown],
  markdownStream: [chat1.output.stream],
  ui: [codeInterpreter.render, error.render],
});

export default agent;
export const nodes = [CodeInterpreter, AgentError];
export const __reagentai_exports__ = true;
