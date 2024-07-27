import dedent from "dedent";
import { Observable, ReplaySubject } from "rxjs";

import { ChatCompletionExecutor } from "../../llm/executors/index.js";
import {
  ChatPromptTemplate,
  FormattedChatMessage,
  MessagesPlaceholder,
} from "../../llm/prompt/index.js";
import {
  createStreamDeltaStringSubscriber,
  parseStringErrorMessage,
  parseStringResponse,
} from "../../llm/plugins/response.js";
import { z, Context, createReagentNode } from "../index.js";
import { BaseModelProvider } from "../../llm/models/index.js";

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
</svg>`;

const configSchema = z.object({
  systemPrompt: z
    .string()
    .default("You are an AI assistant.")
    .optional()
    .label("System Prompt")
    .ui({
      type: "textarea",
    }),
  temperature: z.number({ coerce: true }).default(0.9).label("Temperature"),
  stream: z.boolean().default(true).label("Stream"),
});

const inputSchema = z.object({
  model: z.instanceof(BaseModelProvider),
  query: z.string().label("Query"),
  context: z.string().optional().label("Context"),
  chatHistory: z
    .array(z.custom<FormattedChatMessage>())
    .optional()
    .label("Chat History"),
});

type ChatResponseStream = {
  type: "content/delta";
  delta: string;
};

const outputSchema = z.object({
  stream: z.instanceof(Observable<ChatResponseStream>).label("Markdown stream"),
  markdown: z.string().label("Markdown"),
  error: z.string().label("Error"),
});

const ChatCompletion = createReagentNode({
  id: "@core/chat-completion",
  version: "0.0.1",
  name: "Chat completion",
  description: "Generate chat response using AI",
  icon: ICON,
  config: configSchema,
  input: inputSchema,
  output: outputSchema,
  async *execute(
    context: Context<
      z.infer<typeof configSchema>,
      z.infer<typeof outputSchema>
    >,
    input: z.infer<typeof inputSchema>
  ) {
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

    const executor = new ChatCompletionExecutor({
      runnables: [prompt, input.model],
      variables: {},
    });

    const stream = new ReplaySubject<any>();
    const completionOptions = {
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
            type: "message/content/delta",
            delta: chunk,
          });
        }),
      ],
    };
    const res = executor.invoke(completionOptions);

    yield { stream };
    const invokeContext = await res.catch((e) => {
      // if the error has context, return context
      // else propagate error
      if (e.context) {
        return e.context;
      }
      throw e;
    });

    const response = parseStringResponse(invokeContext);
    const error = parseStringErrorMessage(invokeContext);
    yield {
      error,
      markdown: response,
    };
    stream.complete();
  },
});

export default ChatCompletion;
