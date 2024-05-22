import React from "react";
import dedent from "dedent";
import { ReplaySubject, Subject } from "rxjs";
import { renderToString } from "react-dom/server";
import { HiSparkles } from "react-icons/hi";

import { ChatCompletionExecutor } from "../../executors";
import { ChatPromptTemplate, MessagesPlaceholder } from "../../prompt";
import {
  createStreamDeltaStringSubscriber,
  parseStringResponse,
} from "../../plugins/response";
import { Groq } from "../../integrations/models";
import { z, Context, createAgentNode } from "../";

const configSchema = z.object({
  systemPrompt: z
    .string()
    .default("You are an AI assistant.")
    .label("System Prompt")
    .uiSchema({
      type: "textarea",
    }),
  temperature: z.number({ coerce: true }).default(0.9).label("Temperature"),
  stream: z.boolean().default(false).label("Stream"),
});

const inputSchema = z.object({
  query: z.string().label("Query"),
  context: z.string().default("").label("Context"),
  chatHistory: z.any().array().default([]).label("Chat History"),
  tools: z.any().array().label("Tools"),
});

const outputSchema = z.object({
  stream: z.instanceof(Subject).label("Markdown stream"),
  markdown: z.string().label("Markdown"),
  tools: z.any().array().label("Tool calls"),
});

const ChatCompletion = createAgentNode({
  id: "@core/chat-completion",
  version: "0.0.1",
  name: "Chat completion",
  icon: renderToString(React.createElement(HiSparkles, {})),
  input: inputSchema,
  output: outputSchema,
  async *run(
    context: Context<
      z.infer<typeof configSchema>,
      z.infer<typeof outputSchema>
    >,
    input: z.infer<typeof inputSchema>
  ) {
    await new Promise((resolve) => setTimeout(resolve, 3_000));
    const config = configSchema.parse(context.config);
    const prompt = ChatPromptTemplate.fromMessages([
      [
        "system",
        dedent`
        {systemPrompt}

        {context}
        `,
      ],
      new MessagesPlaceholder("chatHistory"),
      ["human", "{query}"],
    ]);

    const chainModel = new Groq({
      model: "llama3-8b-8192",
    });

    const executor = new ChatCompletionExecutor({
      runnables: [prompt, chainModel],
      variables: {},
    });

    const stream = new ReplaySubject<any>();
    const res = executor.invoke({
      variables: {
        systemPrompt: config.systemPrompt,
        context: input.context || "",
        query: input.query,
        chatHistory: input.chatHistory || [],
      },
      config: {
        temperature: config.temperature || 0.7,
        stream: config.stream,
      },
      plugins: [
        createStreamDeltaStringSubscriber((chunk) => {
          stream.next({
            runId: context.run.id,
            nodeId: context.node.id,
            type: "content/delta",
            delta: chunk,
          });
        }),
      ],
    });

    yield { stream };
    const ctxt = await res;

    const response = parseStringResponse(ctxt);
    stream.complete();
    yield {
      markdown: response,
    };
  },
});

export default ChatCompletion;
