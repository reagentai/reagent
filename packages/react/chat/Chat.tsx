import React, { memo, useMemo } from "react";
import { WorkflowNode } from "@reagentai/reagent";

import { Chatbox } from "./chatbox/simple/index.js";
import { ChatThread, MarkdownOptions } from "./ChatThread.js";
import { ChatStore } from "./state.js";
import { ReagentChatContext } from "./context.js";

const ReagentChat = memo(
  (props: {
    store: ChatStore;
    templates: WorkflowNode<any, any, any>[];
    smoothScroll?: boolean;
    EmptyScreen?: React.ReactNode;
    Loader?: React.ReactNode;
    ChatBox?: React.ReactNode;
    markdown?: MarkdownOptions;
  }) => {
    const templatesById = useMemo(() => {
      return props.templates.reduce((agg, curr) => {
        // @ts-expect-error
        agg[curr.id] = curr;
        return agg;
      }, {});
    }, [props.templates]);

    return (
      <ReagentChatContext.Provider
        value={{
          store: props.store,
          templatesById,
          ChatBox: props.ChatBox,
          Loader: props.Loader,
          markdown: props.markdown,
        }}
      >
        <div className="chat relative flex-1 h-full overflow-hidden">
          <div className="relative h-full min-w-[300px] overflow-hidden">
            <div className="h-full text-xs">
              <ChatThread smoothScroll={props.smoothScroll} />
            </div>
            <div className="chatbox-container absolute bottom-0 w-full px-4 flex justify-center pointer-events-none">
              <div className="flex-1 pb-4 min-w-[200px] max-w-[750px] rounded-lg pointer-events-auto backdrop-blur-xl space-y-1">
                {props.ChatBox ? props.ChatBox : <Chatbox />}
              </div>
            </div>
          </div>
        </div>
      </ReagentChatContext.Provider>
    );
  },
  (prev, next) => {
    return prev.store === next.store;
  }
);

export { ReagentChat };
