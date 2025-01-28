import dedent from "dedent";
import { Observable, ReplaySubject } from "rxjs";
import zodToJsonSchema from "zod-to-json-schema";
import delve from "dlv";
import { includeKeys } from "filter-obj";
import { isEmpty } from "lodash-es";

import { ChatCompletionExecutor } from "../../llm/executors/index.js";
import {
  ChatMessages,
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "../../llm/prompt/index.js";
import {
  ToolCall,
  createStreamDeltaStringSubscriber,
  parseStringErrorMessage,
  parseStringResponse,
  parseToolCallsResponse,
} from "../../llm/plugins/response.js";
import { z, Context, createReagentNode } from "../index.js";
import { Runnable } from "../../llm/core/index.js";
import { agentToolSchema } from "../core/schemas.js";
import { BaseModelProvider } from "../../llm/models/index.js";
import { Tool } from "../execution/types.js";

const ICON = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="w-6 h-6">
<path stroke-linecap="round" stroke-linejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" />
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
  query: z
    .string()
    .ui({
      type: "textarea",
    })
    .label("Query"),
  context: z
    .string()
    .optional()
    .ui({
      type: "textarea",
    })
    .label("Context"),
  chatHistory: z.array(z.any()).optional().label("Chat History"),
  tools: agentToolSchema.array().optional().label("Tools"),
});

type ChatResponseStream = {
  type: "content/delta";
  delta: string;
};

const outputSchema = z.object({
  stream: z.instanceof(Observable<ChatResponseStream>).label("Markdown stream"),
  markdown: z.string().label("Markdown"),
  error: z.string().label("Error"),
  tools: z.any().array().label("Tool calls"),
});

const ChatCompletionWithToolCalling = createReagentNode({
  id: "@core/chat-completion-with-tool-calling",
  version: "0.0.1",
  name: "Chat completion with Tool Calling",
  description: "Generate chat response using LLM tool-calling",
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

    const tools = new ToolsProvider(input.tools);
    const executor = new ChatCompletionExecutor({
      runnables: [prompt, input.model, tools],
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
      console.error(e);
      // if the error has context, return context
      // else propagate error
      if (e.context) {
        return e.context;
      }
      throw e;
    });

    const response = parseStringResponse(invokeContext);
    const toolCalls = parseToolCallsResponse(invokeContext);
    const error = parseStringErrorMessage(invokeContext);

    if (toolCalls && toolCalls.length > 0) {
      const toolResults = await tools.invokeTools(toolCalls);

      // Only call llm again if the tool call result isn't empty
      if (toolResults.length > 0) {
        const messages = await executor.resolve(
          "core.prompt.chat.messages",
          invokeContext,
          {}
        );
        const aiResponse = delve(
          invokeContext,
          "state.core.llm.response.data.choices.0.message"
        );
        const chatCompletionWithToolCallResult = new ChatCompletionExecutor({
          runnables: [
            prompt,
            input.model,
            // TODO: filter only the tools used by the tool call
            tools,
            ChatMessages.fromMessages([
              ...messages,
              aiResponse,
              ...toolResults,
            ]),
          ],
          allowRunnableOverride: true,
        });

        const result2 = await chatCompletionWithToolCallResult
          .invoke(completionOptions)
          .catch((e) => {
            // if the error has context, return context
            // else propagate error
            if (e.context) {
              return e.context;
            }
            throw e;
          });
        const response = parseStringResponse(result2);
        const error = parseStringErrorMessage(result2);
        yield {
          error,
          markdown: response,
          tools: toolCalls,
        };
      }
      yield {
        error,
        markdown: response,
      };
    } else {
      yield {
        error,
        markdown: response,
      };
    }
    stream.complete();
  },
});

const TOOL = Symbol("__TOOL__");

type ToolZodSchema = NonNullable<z.infer<typeof inputSchema>["tools"]>[0];
type ToolSchema = {
  type: "function";
  function: Pick<ToolZodSchema, "name" | "description"> & {
    parameters: Record<string, any>;
  };

  [TOOL]: Tool<any, any>;
};

class ToolsProvider extends Runnable {
  toolsJson?: ToolSchema[];
  constructor(tools?: ToolZodSchema[]) {
    super();
    this.toolsJson = tools?.map((tool) => {
      return {
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: includeKeys(
            // @ts-expect-error
            zodToJsonSchema(tool.parameters),
            ["type", "properties", "required"]
          ),
        },
        [TOOL]: tool,
      };
    });
  }

  get namespace(): string {
    return "core.prompt.tools.json";
  }

  async run() {
    return this.toolsJson;
  }

  async invokeTools(toolCalls: ToolCall[]) {
    const tools = (await this.run())!;
    const result = await Promise.all(
      toolCalls.map(async (toolCall) => {
        const tool = tools.find((tool: any) => {
          return tool.function.name == toolCall.function.name;
        });
        if (!tool) {
          throw new Error(
            `unexpected error: tool [${toolCall.function.name}] in tool call not found`
          );
        }
        const output = await tool[TOOL].execute(toolCall.function.arguments);
        if (typeof output == "object" && isEmpty(output)) {
          return undefined;
        }

        return {
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          output,
          content: typeof output == "object" ? JSON.stringify(output) : output,
        };
      })
    );
    return result.filter((r) => r != undefined);
  }
}

export default ChatCompletionWithToolCalling;
