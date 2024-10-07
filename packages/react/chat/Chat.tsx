import React, { createContext, useContext } from "react";

import { Chatbox } from "./chatbox/simple/index.js";
import { ChatThread } from "./ChatThread.js";
import { ChatStore } from "./state.js";

type ReagentChatContext = {
  store: ChatStore;
};

const ReagentChatContext = createContext<ReagentChatContext>({} as any);

const useReagentChatContext = () => useContext(ReagentChatContext)!;

const ReagentChat = (props: {
  store: ChatStore;
  EmptyScreen?: React.ReactNode;
  Loader?: React.ReactNode;
  ChatBox?: React.ReactNode;
}) => {
  return (
    <ReagentChatContext.Provider value={{ store: props.store }}>
      <div className="chat relative flex-1 h-full overflow-hidden">
        <div className="relative h-full min-w-[300px] overflow-hidden">
          <div className="h-full text-xs">
            <ChatThread
              store={props.store}
              EmptyScreen={props.EmptyScreen}
              Loader={props.Loader}
            />
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
};

export { ReagentChat, useReagentChatContext };
