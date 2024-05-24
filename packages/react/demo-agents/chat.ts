import { GraphAgent, z } from "@portal/reagent/agent";
import { Passthrough, ChatCompletion, User } from "@portal/reagent/agent/nodes";

const agent = new GraphAgent();

const input = agent.addNode(
  "input",
  new Passthrough(
    z.object({
      query: z.string(),
    })
  )
);

const chat1 = agent.addNode("chat-1", new ChatCompletion(), {
  systemPrompt: "You are an amazing AI assistant called Jarvis",
  temperature: 0.9,
  stream: true,
});

const user = agent.addNode("user", new User());

chat1.bind({
  query: input.output.query,
});

user.bind({
  markdown: chat1.output.markdown,
  markdownStream: chat1.output.stream,
});

export { agent };
