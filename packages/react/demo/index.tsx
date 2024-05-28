import { ErrorBoundary } from "react-error-boundary";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStreamToAsyncIterator } from "@portal/reagent/llm/stream";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/DropdownMenu";
import { AIChat, createChatStore } from "../chat";
import { AgentContextProvider } from "../agent";
import { AgentError } from "../demo-agents/tools/AgentError";
import { GetWeather } from "../demo-agents/tools/Weather";

const llmModels = [
  {
    id: "openai-gtp-3.5",
    label: "OpenAI GPT 3.5",
    model: {
      provider: "openai",
      name: "gpt-3.5-turbo",
    },
  },
  {
    id: "groq-llama-3-7b",
    label: "Groq Llama 3 7B",
    model: {
      provider: "groq",
      name: "llama3-8b-8192",
    },
  },
  {
    id: "groq-llama-3-70b",
    label: "Groq Llama 3 70B",
    model: {
      provider: "groq",
      name: "llama3-70b-8192",
    },
  },
];

const ReagentDemo = (props: { agentId: string }) => {
  const llmModel = useTopBarStore((s: any) => s.llmModel);
  const store = createChatStore(
    {
      messages: {},
      async sendNewMessage(input, state) {
        const res = await fetch(`/api/chat/sendMessage`, {
          method: "POST",
          body: JSON.stringify({
            ...input,
            agentId: props.agentId,
            model: llmModels.find((m) => m.id == llmModel)?.model,
          }),
          headers: {
            "content-type": "application/json",
          },
        });
        const iterator = jsonStreamToAsyncIterator(res.body!);
        async function* asyncGenerator() {
          for await (const { json } of iterator) {
            yield json;
          }
        }
        return asyncGenerator();
      },
    },
    {
      persistKey: "portal-reagent-demo-chat",
    }
  );

  return (
    <div className="h-full flex flex-col">
      <TopBar chatStore={store} />
      <ErrorBoundary fallback={<div>ERROR!</div>}>
        <AgentContextProvider nodes={[GetWeather, AgentError]}>
          <AIChat store={store} />
        </AgentContextProvider>
      </ErrorBoundary>
    </div>
  );
};

const TopBar = (props: { chatStore: any }) => {
  const llmModel = useTopBarStore((s: any) => s.llmModel);
  const setLLMModel = useTopBarStore((s: any) => s.setLLMModel);
  return (
    <div className="w-screen py-1 px-2 flex justify-end space-x-4 text-xs bg-gray-50">
      <DropdownMenu>
        <DropdownMenuTrigger className="px-2 select-none outline-none">
          {llmModels.find((m) => m.id == llmModel)?.id || "Select model"}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Select model</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={llmModel} onValueChange={setLLMModel}>
            {llmModels.map((model, index) => {
              return (
                <DropdownMenuRadioItem key={index} value={model.id}>
                  {model.label}
                </DropdownMenuRadioItem>
              );
            })}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      <div className="top-4 right-4">
        <div
          className="bg-indigo-200 rounded px-4 py-1 cursor-pointer"
          onClick={() => {
            props.chatStore.persist.clearStorage();
            useTopBarStore.persist.clearStorage();
          }}
        >
          Reset
        </div>
      </div>
    </div>
  );
};

const useTopBarStore = create(
  persist(
    (set, get) => {
      return {
        llmModel: undefined,
        setLLMModel(model: string) {
          set((prev: any) => {
            return {
              ...prev,
              llmModel: model,
            };
          });
        },
      };
    },
    {
      name: "reagent-demo-chat-topbar",
    }
  )
);

export default ReagentDemo;
