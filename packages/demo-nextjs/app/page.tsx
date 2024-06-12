"use client";
import { useMemo, useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { jsonStreamToAsyncIterator } from "@reagentai/reagent/llm/stream/index.js";
import { AIChat, createChatStore } from "@reagentai/react/chat";
import { AgentContextProvider } from "@reagentai/react/agent";

const ChatAgent = () => {
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const store = useMemo(
    () =>
      createChatStore(
        {
          messages: {},
          async invoke(nodeId, input, state) {
            const res = await fetch(`/api/chat/invoke`, {
              method: "POST",
              body: JSON.stringify({
                ...input,
              }),
              headers: {
                "content-type": "application/json",
              },
            });
            if (res.status != 200) {
              setInvokeError((await res.text()) || res.statusText);
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
  return (
    <div className="flex">
      <div className="flex-1 h-screen">
        <div className="flex flex-col flex-1 h-full overflow-auto">
          <ErrorBoundary fallback={<div>ERROR!</div>}>
            {invokeError && (
              <div className="py-3 text-center text-base text-red-700">
                Error sending message: {invokeError}
              </div>
            )}
            <div className="h-full">
              <AgentContextProvider nodes={[]}>
                <AIChat store={store} />
              </AgentContextProvider>
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default ChatAgent;
