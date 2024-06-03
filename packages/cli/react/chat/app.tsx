import { Suspense, lazy, useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { jsonStreamToAsyncIterator } from "@reagentai/reagent/llm/stream";
import { AIChat, createChatStore } from "@reagentai/react/chat";
import { AgentContextProvider } from "@reagentai/react/agent";
// @ts-expect-error
import agent, { nodes as agentNodes } from "virtual:reagent-agent-module";
import "reagent.css";

// @ts-expect-error
const AgentGraph = lazy(() => import("./graph.tsx"));

const Agent = () => {
  const [sendMessageError, setSendMessageEError] = useState<string | null>(
    null
  );
  const [isAgentGraphVisible, setAgentGraphVisiblity] = useState(false);
  const store = useMemo(
    () =>
      createChatStore(
        {
          messages: {},
          async sendNewMessage(input, state) {
            const res = await fetch(`/api/chat/sendMessage`, {
              method: "POST",
              body: JSON.stringify(input),
              headers: {
                "content-type": "application/json",
              },
            });
            if (res.status != 200) {
              setSendMessageEError((await res.text()) || res.statusText);
              return (async function* asyncGenerator() {})();
            }
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
          persistKey: `reagent-dev-chat-app`,
        }
      ),
    []
  );

  const messages = store((s) => s.messages);
  return (
    <div className="flex">
      <div className="flex-1 h-screen">
        <div className="h-full flex-col">
          <div className="h-9 shadow shadow-gray-300">
            <TopBar
              isAgentGraphVisible={isAgentGraphVisible}
              toggleAgentGraphVisiblity={() => {
                setAgentGraphVisiblity(!isAgentGraphVisible);
              }}
              chatStore={store}
            />
          </div>
          <div className="flex flex-1 h-[calc(100%-theme(spacing.9))] divide-x-2 divide-gray-200 overflow-hidden">
            <div className="flex-1 h-full overflow-auto">
              <ErrorBoundary fallback={<div>ERROR!</div>}>
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
                {sendMessageError && (
                  <div className="py-3 text-center text-base text-red-700">
                    Error sending message: {sendMessageError}
                  </div>
                )}
                <AgentContextProvider nodes={agentNodes || []}>
                  <AIChat store={store} />
                </AgentContextProvider>
              </ErrorBoundary>
            </div>
            {isAgentGraphVisible && (
              <Suspense>
                <div className="flex-1">
                  <AgentGraph agentId="default" />
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
  chatStore: any;
  isAgentGraphVisible: boolean;
  toggleAgentGraphVisiblity: () => void;
}) => {
  return (
    <div className="top-bar w-full h-full py-1.5 px-2 flex justify-end space-x-4 text-xs bg-gray-100">
      <div className="flex flex-1 items-center">
        <div className="pl-32 font-medium text-sm text-gray-600">
          {agent.name}
        </div>
      </div>
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

export default Agent;
