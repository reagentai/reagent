import { createReagentNode, z } from "@reagentai/reagent";
import { Loader, CircleCheckBig } from "lucide-react";
import ky from "ky";
import zodToJsonSchema from "zod-to-json-schema";
import { Runnable } from "@reagentai/reagent/llm/core";
import { ChatCompletionExecutor } from "@reagentai/reagent/llm/executors";
import {
  createStreamDeltaStringSubscriber,
  parseStringErrorMessage,
  parseStringResponse,
  parseToolCallsResponse,
} from "@reagentai/reagent/llm/plugins";
import {
  ChatPromptTemplate,
  MessagesPlaceholder,
} from "@reagentai/reagent/llm/prompt";
import { ReplaySubject } from "@reagentai/reagent/rxjs";
import dedent from "dedent";
import { isEmpty } from "lodash-es";
import { includeKeys } from "filter-obj";

import { tools as intercomTools } from "../thirdparty/intercom.js";

const CopilotNode = createReagentNode({
  id: "input",
  name: "Copilot",
  description: "Baton Copilot",
  version: "0.1.0",
  input: z.object({
    systemPrompt: z.string(),
    context: z.string(),
    query: z.string(),
    temperature: z.number(),
    stream: z.boolean(),
    model: z.any(),
  }),
  output: z.object({
    done: z.boolean(),
  }),
  async *execute(context, input) {
    const browser = {
      step: context.step,
      fetch(stepId, options) {
        return context.prompt(
          ({ key, data, submit, React }) => {
            React.useEffect(() => {
              ky(data.url, {
                method: data.method,
                headers: data.headers,
                body: data.body,
                json: data.json,
              }).then(async (res) => {
                submit({
                  headers: {},
                  error: null,
                  data: data.json ? await res.json() : await res.text(),
                  // body: await res.text(),
                });
              });
            }, [key]);
            return <div></div>;
          },
          {
            key: "fetch-" + stepId,
            data: options,
          }
        );
      },
      showStatus(step, options) {
        const updater = context.render(
          (props) => {
            return (
              <div className="status flex items-center py-3 px-3 font-medium rounded-md border border-gray-100 space-x-2">
                {props.data.status == "IN_PROGRESS" && (
                  <Loader className="w-3 h-3 animate-spin" />
                )}
                {props.data.status == "DONE" && (
                  <CircleCheckBig className="w-3 h-3 text-green-700" />
                )}
                <div>{props.data.text}</div>
              </div>
            );
          },
          { data: options, key: "status-" + step }
        );
        return {
          update(key, data) {
            updater.update(data, {
              key,
            });
          },
        };
      },
    };

    const llmCall = await context.step("llm-step-1", async () => {
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

      const tools = new ToolsProvider(intercomTools);
      const executor = new ChatCompletionExecutor({
        runnables: [prompt, input.model, tools],
        variables: {},
      });

      const stream = new ReplaySubject();
      const completionOptions = {
        variables: {
          systemPrompt: input.systemPrompt,
          context: input.context || "",
          query: input.query,
          // chatHistory: options.chatHistory || [],
          chatHistory: [],
        },
        config: {
          temperature: input.temperature || 0.7,
          stream: input.stream,
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
      const invokeContext = await res.catch((e) => {
        console.error(e);
        // if the error has context, return context
        // else propagate error
        if (e.context) {
          return e.context;
        }
        throw e;
      });
      stream.complete();

      console.log("invokeContext =", JSON.stringify(invokeContext.state));

      const response = parseStringResponse(invokeContext);
      const toolCalls = parseToolCallsResponse(invokeContext);
      const error = parseStringErrorMessage(invokeContext);

      return {
        response,
        toolCalls,
        error,
      };
    });

    const { toolCalls } = llmCall.result;
    console.log("toolCalls =", toolCalls);
    if (toolCalls && toolCalls.length > 0) {
      const result = [];
      for (let i = 0; i < toolCalls.length; i++) {
        const toolCall = toolCalls[i];
        const tool = intercomTools[toolCall.function.name];
        if (!tool) {
          throw new Error(
            `unexpected error: tool [${toolCall.function.name}] in tool call not found`
          );
        }
        console.log("CALLING TOOL:", toolCall.function.name);
        const output = yield context.task(tool.execute, {
          context: {
            step: context.step,
          },
          browser,
          parameters: toolCall.function.arguments,
        });
        if (typeof output == "object" && isEmpty(output)) {
          return undefined;
        }

        result.push({
          tool_call_id: toolCall.id,
          role: "tool",
          name: toolCall.function.name,
          output,
          content: typeof output == "object" ? JSON.stringify(output) : output,
        });
      }
      const toolResults = result.filter((r) => r != undefined);

      console.log("toolResults =", toolResults);
    }

    yield { done: true };
  },
});

const TOOL = Symbol("__TOOL__");
class ToolsProvider extends Runnable {
  constructor(tools) {
    super();
    this.tools = tools;
  }

  get namespace() {
    return "core.prompt.tools.json";
  }

  async run() {
    return Object.entries(this.tools)
      .map(([name, v]) => ({ ...v, name }))
      .map((tool) => {
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
}

export { CopilotNode };
export const __reagentai_exports__ = true;
