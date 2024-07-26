import { Workflow } from "@reagentai/reagent/workflow";
import {
  ChatCompletionWithToolCalling,
  WorkflowInput,
} from "@reagentai/reagent/nodes";
import { AgentError } from "@reagentai/react/tools/AgentError.js";
import { CodeInterpreter } from "@reagentai/thirdparty/e2b/index.js";

const workflow = new Workflow({
  name: "E2B data analysis agent",
  description: "This is a demo code interpreter agent using E2B",
});

const input = workflow.addNode("input", new WorkflowInput());
const error = workflow.addNode("error", new AgentError());

const chat1 = workflow.addNode("chat-1", new ChatCompletionWithToolCalling(), {
  config: {
    systemPrompt: "You are an amazing AI assistant",
    temperature: 0.9,
    stream: true,
  },
});

const codeInterpreter = workflow.addNode(
  "code-interpreter",
  new CodeInterpreter()
);

chat1.bind({
  model: input.output.model,
  query: input.output.query,
  tools: [
    codeInterpreter.asTool({
      bind: {},
      parameters: ["code"],
      output: [],
    }),
  ],
});

error.bind({
  error: chat1.output.error,
});

workflow.bind({
  markdown: [chat1.output.markdown],
  markdownStream: [chat1.output.stream],
  ui: [codeInterpreter.renderOutput, error.renderOutput],
});

export default workflow;
export const nodes = [CodeInterpreter, AgentError];
export const __reagentai_exports__ = true;
