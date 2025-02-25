import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { create, useStore } from "zustand";
import { persist } from "zustand/middleware";
import { ReagentChat, createChatStore } from "@reagentai/react/chat";
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
import * as workflowModule from "virtual:reagent-agent-module";
import "./reagent.css";

import { models as llmModels } from "../../models";

// @ts-expect-error
const WorkflowGraph = lazy(() => import("./graph.tsx"));

const App = () => {
  const workflowId = "default";
  const [isAgentGraphVisible, setAgentGraphVisiblity] = useState(false);
  const [workflow, setWorkflow] = useState<any>();
  const llmModelId = useTopBarStore((s: any) => s.llmModelId);
  useEffect(() => {
    fetch(`/api/chat/workflows/${workflowId}`).then(async (res) => {
      const workflow = await res.json();
      setWorkflow(workflow);
    });
  }, []);
  const store = useMemo(
    () =>
      createChatStore(
        {
          messages: {},
          url: "/api/chat/invoke",
          templates: workflowModule.nodes,
          middleware: {
            request(options) {
              return {
                ...options,
                model: llmModels.find((m) => m.id == llmModelId)?.model,
              };
            },
            response: {
              async error(error) {
                if (error instanceof Response) {
                  return (await error.text()) || error.statusText;
                }
                return error.error;
              },
            },
          },
        },
        {
          persistKey: `reagent-dev-chat-app`,
        }
      ),
    []
  );
  const { messages } = useStore(store);

  if (!workflow) {
    return <div className="text-xs text-gray-600">Loading...</div>;
  }
  return (
    <div className="flex">
      <div className="flex-1 h-screen">
        <div className="h-full flex-col">
          <div className="h-9 shadow shadow-gray-300">
            <TopBar
              workflow={workflow}
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
                {Object.entries(messages).length == 0 && workflow && (
                  <div className="workflow-info flex py-20 justify-center">
                    <div className="flex flex-col space-y-5">
                      <div className="text-center text-2xl font-semibold text-gray-700">
                        {workflow.name}
                      </div>
                      <div className="text-gray-600">
                        {workflow.description}
                      </div>
                    </div>
                  </div>
                )}
                <div className="h-full">
                  <ReagentChat
                    store={store}
                    templates={workflowModule.nodes || []}
                  />
                </div>
              </ErrorBoundary>
            </div>
            {isAgentGraphVisible && (
              <Suspense>
                <div className="flex-1">
                  <WorkflowGraph
                    workflowId={workflowId}
                    nodes={workflow.graph.nodes}
                  />
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
  workflow: any;
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
          {props.workflow.name}
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

export default App;
