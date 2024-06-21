"use client";
import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { AIChat, createChatStore } from "@reagentai/react/chat";
import { AgentContextProvider } from "@reagentai/react/agent";
import * as agent from "@reagentai/react-examples/weather";

const ChatAgent = () => {
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const store = createChatStore(
    {
      messages: {},
      invokeUrl: "/api/chat/invoke",
      middleware: {
        request(options) {
          setInvokeError(null);
          return {
            nodeId: options.nodeId,
            input: options.input,
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
              <AgentContextProvider nodes={agent.nodes || []}>
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
