import { useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { jsonStreamToAsyncIterator } from "@useportal/reagent/llm/stream";

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
import Sidebar, { SidebarProps } from "./Sidebar";

type AgentInfo = {
  id: string;
  name: string;
  description: string;
};

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

const ReagentDemo = (props: Omit<SidebarProps, "agents">) => {
  const [agents, setAgents] = useState<AgentInfo[]>(null!);
  useEffect(() => {
    fetch("/api/chat/agents").then(async (res: any) => {
      setAgents(await res.json());
    });
  }, []);

  const llmModel = useTopBarStore((s: any) => s.llmModel);
  const store = useMemo(
    () =>
      createChatStore(
        {
          messages: {},
          async sendNewMessage(input, state) {
            const res = await fetch(`/api/chat/sendMessage`, {
              method: "POST",
              body: JSON.stringify({
                ...input,
                agentId: props.activeAgentId,
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
          persistKey: `portal-reagent-demo-chat-${props.activeAgentId}`,
        }
      ),
    [props.activeAgentId, llmModel]
  );

  const agent = useMemo(() => {
    if (!agents) {
      return null;
    }
    return agents.find((a) => a.id == props.activeAgentId);
  }, [props.activeAgentId, agents]);
  const messages = store((s) => s.messages);

  if (!agents) {
    return <div></div>;
  }

  return (
    <div className="flex">
      <div className="basis-52 h-screen bg-gray-50">
        <Sidebar {...props} agents={agents} />
      </div>
      <div className="flex-1 h-screen overflow-auto">
        <div className="h-full flex flex-col">
          <TopBar chatStore={store} />
          <ErrorBoundary fallback={<div>ERROR!</div>}>
            <AgentContextProvider nodes={[GetWeather, AgentError]}>
              {!agent && (
                <div className="py-20 text-center font-medium text-red-700">
                  Invalid agent id
                </div>
              )}
              {Object.entries(messages).length == 0 && agent && (
                <div className="flex py-20 justify-center">
                  <div className="flex flex-col space-y-5">
                    <div className="text-center text-2xl font-semibold text-gray-700">
                      {agent.name}
                    </div>
                    <div className="text-gray-600">{agent.description}</div>
                  </div>
                </div>
              )}
              <AIChat store={store} />
            </AgentContextProvider>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

const TopBar = (props: { chatStore: any }) => {
  const llmModel = useTopBarStore((s: any) => s.llmModel);
  const setLLMModel = useTopBarStore((s: any) => s.setLLMModel);
  return (
    <div className="w-full py-1 px-2 flex justify-end space-x-4 text-xs bg-gray-50">
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
            window.location.reload();
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
