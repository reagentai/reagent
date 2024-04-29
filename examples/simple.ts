import dedent from "dedent";
import { ChatCompletionExecutor } from "../executors/ChatCompletion";
import { ChatPromptTemplate } from "../prompt";
import { MessagesPlaceholder } from "../prompt/history";
import { DummyModel } from "../models/dummy";
import { createStringResponseSubscriber } from "../plugins/response";

const promptTemplate = ChatPromptTemplate.fromMessages([
  [
    "system",
    dedent`
    {systemPrompt}`,
  ],
  new MessagesPlaceholder("chat_history"),
  ["human", "{input}"],
]);

const model = new DummyModel({
  response: "Hello there, how you doing?",
});

const executor = new ChatCompletionExecutor({
  runnables: [promptTemplate, model],
  variables: {
    systemPrompt: async () =>
      "You are an amazing AI agent called Atlas who is really good at python programming.",
    chat_history: () => {
      return [];
    },
  },
});

executor.invoke({
  plugins: [
    createStringResponseSubscriber((message) => {
      console.log("Response =", message);
    }),
  ],
});
