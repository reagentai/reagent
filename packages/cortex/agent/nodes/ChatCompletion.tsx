import dedent from "dedent";
import { Observable, ReplaySubject } from "rxjs";

import { ChatCompletionExecutor } from "../../executors";
import { ChatPromptTemplate, MessagesPlaceholder } from "../../prompt";
import {
  createStreamDeltaStringSubscriber,
  parseStringResponse,
} from "../../plugins/response";
import { Groq } from "../../integrations/models";
import { z, Context, createAgentNode } from "../";

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
</svg>`;

const configSchema = z.object({
  systemPrompt: z
    .string()
    .default("You are an AI assistant.")
    .optional()
    .label("System Prompt")
    .uiSchema({
      type: "textarea",
    }),
  temperature: z.number({ coerce: true }).default(0.9).label("Temperature"),
  stream: z.boolean().default(false).label("Stream"),
});

const inputSchema = z.object({
  query: z.string().label("Query"),
  context: z.string().optional().label("Context"),
  chatHistory: z.array(z.any()).optional().label("Chat History"),
  tools: z.object({ test: z.string() }).array().optional().label("Tools"),
});

type ChatResponseStream = {
  runId: string;
  nodeId: string;
  type: "content/delta";
  delta: string;
};

const outputSchema = z.object({
  stream: z.instanceof(Observable<ChatResponseStream>).label("Markdown stream"),
  markdown: z.string().label("Markdown"),
  tools: z.any().array().label("Tool calls"),
});

const ChatCompletion = createAgentNode({
  id: "@core/chat-completion",
  version: "0.0.1",
  name: "Chat completion",
  icon: ICON,
  config: configSchema,
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
            type: "message/content/delta",
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
