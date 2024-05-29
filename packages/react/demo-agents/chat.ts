import { GraphAgent } from "@useportal/reagent/agent";
import { ChatCompletion, User } from "@useportal/reagent/agent/nodes";

import { createInputNode } from "./input";
import { DummyModel } from "@useportal/reagent/llm/models/dummy";

const agent = new GraphAgent();

const input = agent.addNode("input", createInputNode());

const chat1 = agent.addNode("chat-1", new ChatCompletion(), {
  systemPrompt: "You are an amazing AI assistant called Jarvis",
  temperature: 0.9,
  stream: true,
});

const user = agent.addNode("user", new User());

chat1.bind({
  model: input.output.model,
  query: input.output.query,
});

user.bind({
  markdown: chat1.output.markdown,
  markdownStream: chat1.output.stream,
});

// const now = performance.now();
// const time = new Date().getTime()
// const run = input.invoke({
//   model: new DummyModel({ response: "YO" }),
//   query: "hello",
// });

// console.log("time taken =", performance.now() - now);
// user.output.markdown.select({ runId: run.run.id }).then((data) => {
//   console.log("time taken =", performance.now() - now);
//   console.log("time taken =", new Date().getTime() - time);
//   console.log("DATA =", data);
// });

export { agent };
