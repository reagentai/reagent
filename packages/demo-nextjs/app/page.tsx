"use client";
import { useState } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
  ReagentContextProvider,
  ReagentChat,
  createChatStore,
} from "@reagentai/react/chat";

import * as agent from "./workflow/workflow";

const ChatAgent = () => {
  console.log("agent.nodes =", agent.nodes);
  const [invokeError, setInvokeError] = useState<string | null>(null);
  const store = createChatStore(
    {
      messages: {},
      url: "/api/chat",
      templates: agent.nodes as any[],
      middleware: {
        request(request) {
          setInvokeError(null);
          return request;
        },
        response: {
          async error(res) {
            if (res instanceof Response) {
              return (await res.text()) || res.statusText;
            } else {
              return res.error;
            }
          },
        },
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
              <ReagentContextProvider templates={agent.nodes || []}>
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
