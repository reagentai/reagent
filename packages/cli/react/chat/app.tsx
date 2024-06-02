import { useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { jsonStreamToAsyncIterator } from "@reagentai/reagent/llm/stream";
import { AIChat, createChatStore } from "@reagentai/reagent-react/chat";
import { AgentContextProvider } from "@reagentai/reagent-react/agent";
// @ts-expect-error
import agent, { nodes as agentNodes } from "virtual:reagent-agent-module";
import "reagent.css";

const Agent = () => {
  const [sendMessageError, setSendMessageEError] = useState<string | null>(
    null
  );
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
      <div className="flex-1 h-screen overflow-auto">
        <div className="h-full flex flex-col">
          <TopBar chatStore={store} />
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
            <AgentContextProvider
              nodes={[]}
              // nodes={[GetWeather, GenerateSQLQuery, AgentError]}
            >
              <AIChat store={store} />
            </AgentContextProvider>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

const TopBar = (props: { chatStore: any }) => {
  return (
    <div className="w-full py-1 px-2 flex justify-end space-x-4 text-xs bg-gray-50">
      <div className="flex flex-1 items-center">
        <div className="pl-32 font-medium text-sm text-gray-600">
          {agent.name}
        </div>
      </div>
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

export default Agent;
