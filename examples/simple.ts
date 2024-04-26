import dedent from "dedent";
import { SimpleExecutor } from "../src/executors/SingleLLMQuery";
import { ChatPromptTemplate } from "../src/prompt";
import { MessagesPlaceholder } from "../src/prompt/history";
import { DummyModel } from "../src/models/Dummy";
import { createResponseSubscriber } from "../src/plugins/response";

const promptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    dedent`
    {systemPrompt}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["user", "{input}"],
]);

const model = new DummyModel({
  response: "Hello there, how you doing?",
});

const executor = new SimpleExecutor({
  runnables: [promptTemplate, model],
  variables: {
    systemPrompt: async () =>
      "You are an amazing AI agent called Atlas who is really good at python programming.",
    chat_history: () => {
      return [];
    },
  },
});

executor.invoke("Hello", {
  plugins: [
    createResponseSubscriber((message) => {
      console.log("Response =", message);
    }),
  ],
});
