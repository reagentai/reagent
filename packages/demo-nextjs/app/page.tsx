"use client";
import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import { ReagentChat, createChatStore } from "@reagentai/react/chat";
import { ReagentContextProvider } from "@reagentai/react/agent";
import * as agent from "@reagentai/react-examples/e2b";

const ChatAgent = () => {
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const store = createChatStore(
    {
      messages: {},
      invokeUrl: "/api/chat",
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
              <ReagentContextProvider nodes={agent.nodes || []}>
                <ReagentChat store={store} />
              </ReagentContextProvider>
            </div>
          </ErrorBoundary>
        </div>
      </div>
    </div>
  );
};

export default ChatAgent;
