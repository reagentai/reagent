import { Workflow } from "@reagentai/reagent/workflow";
import { ChatCompletion, WorkflowInput } from "@reagentai/reagent/nodes";

const workflow = new Workflow({
  name: "Simple AI Chat",
  description: "A simple AI chat agent.",
});

const input = workflow.addNode("input", new WorkflowInput());

const chat1 = workflow.addNode("chat-1", new ChatCompletion(), {
  config: {
    systemPrompt: "You are an amazing AI assistant called Jarvis",
    temperature: 0.9,
    stream: true,
  },
});

chat1.bind({
  model: input.output.model,
  query: input.output.query,
});

workflow.bind({
  markdown: [chat1.output.markdown],
  markdownStream: [chat1.output.stream],
});

export default workflow;
export const __reagentai_exports__ = true;
