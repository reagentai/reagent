import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ReagentChat, createChatStore } from "@reagentai/react/chat";
import { ReagentContextProvider } from "@reagentai/react/agent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@reagentai/react/components/DropdownMenu.js";

// @ts-expect-error
import * as agentModule from "virtual:reagent-agent-module";
import "./reagent.css";

import { models as llmModels } from "../../models";

// @ts-expect-error
const AgentGraph = lazy(() => import("./graph.tsx"));

const Agent = () => {
  const agentId = "default";
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const [isAgentGraphVisible, setAgentGraphVisiblity] = useState(false);
  const [agent, setAgent] = useState<any>();
  const llmModelId = useTopBarStore((s: any) => s.llmModelId);
  useEffect(() => {
    fetch(`/api/chat/agents/${agentId}`).then(async (res) => {
      const agent = await res.json();
      setAgent(agent);
    });
  }, []);
  const store = useMemo(
    () =>
      createChatStore(
        {
          messages: {},
          invokeUrl: "/api/chat/invoke",
          middleware: {
            request(options) {
              setInvokeError(null);
              return {
                nodeId: options.nodeId,
                input: options.input,
                model: llmModels.find((m) => m.id == llmModelId)?.model,
              };
            },
          },
          async onInvokeError(res) {
            setInvokeError((await res.text()) || res.statusText);
          },
        },
        {
          persistKey: `reagent-dev-chat-app`,
        }
      ),
    []
  );
  const messages = store((s) => s.messages);

  if (!agent) {
    return <div className="text-xs text-gray-600">Loading...</div>;
  }
  return (
    <div className="flex">
      <div className="flex-1 h-screen">
        <div className="h-full flex-col">
          <div className="h-9 shadow shadow-gray-300">
            <TopBar
              agent={agent}
              isAgentGraphVisible={isAgentGraphVisible}
              toggleAgentGraphVisiblity={() => {
                setAgentGraphVisiblity(!isAgentGraphVisible);
              }}
              chatStore={store}
            />
          </div>
          <div className="flex flex-1 h-[calc(100%-theme(spacing.9))] divide-x-2 divide-gray-200 overflow-hidden">
            <div className="flex flex-col flex-1 h-full overflow-auto">
              <ErrorBoundary fallback={<div>ERROR!</div>}>
                {Object.entries(messages).length == 0 && agent && (
                  <div className="agent-info flex py-20 justify-center">
                    <div className="flex flex-col space-y-5">
                      <div className="text-center text-2xl font-semibold text-gray-700">
                        {agent.name}
                      </div>
                      <div className="text-gray-600">{agent.description}</div>
                    </div>
                  </div>
                )}
                {invokeError && (
                  <div className="py-3 text-center text-base text-red-700">
                    Error sending message: {invokeError}
                  </div>
                )}
                <div className="h-full">
                  <ReagentContextProvider nodes={agentModule.nodes || []}>
                    <ReagentChat store={store} />
                  </ReagentContextProvider>
                </div>
              </ErrorBoundary>
            </div>
            {isAgentGraphVisible && (
              <Suspense>
                <div className="flex-1">
                  <AgentGraph agentId={agentId} nodes={agent.graph.nodes} />
                </div>
              </Suspense>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const TopBar = (props: {
  agent: any;
  chatStore: any;
  isAgentGraphVisible: boolean;
  toggleAgentGraphVisiblity: () => void;
}) => {
  const llmModelId = useTopBarStore((s: any) => s.llmModelId);
  const setLLMModelId = useTopBarStore((s: any) => s.setLLMModelId);
  return (
    <div className="top-bar w-full h-full py-1.5 px-2 flex justify-end space-x-4 text-xs bg-gray-100">
      <div className="flex flex-1 items-center">
        <div className="pl-32 font-medium text-sm text-gray-600">
          {props.agent.name}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="px-2 select-none outline-none">
          {llmModels.find((m) => m.id == llmModelId)?.id || "Select model"}
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>Select model</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={llmModelId}
            onValueChange={setLLMModelId}
          >
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
      <div className="flex top-4 right-4 space-x-3">
        <button
          className="bg-indigo-200 rounded px-4 py-1 cursor-pointer"
          type="button"
          onClick={() => {
            props.toggleAgentGraphVisiblity();
          }}
        >
          {!props.isAgentGraphVisible && "Show graph"}
          {props.isAgentGraphVisible && "Hide graph"}
        </button>
        <button
          className="bg-indigo-200 rounded px-4 py-1 cursor-pointer"
          type="button"
          onClick={() => {
            props.chatStore.persist.clearStorage();
            window.location.reload();
          }}
        >
          Reset
        </button>
      </div>
    </div>
  );
};

const useTopBarStore = create(
  persist(
    (set, get) => {
      return {
        llmModelId: undefined as (typeof llmModels)[0] | undefined,
        setLLMModelId(modelId: string) {
          set((prev: any) => {
            return {
              ...prev,
              llmModelId: modelId,
            };
          });
        },
      };
    },
    {
      name: "reagent-dev-chat-app-topbar",
    }
  )
);

export default Agent;
