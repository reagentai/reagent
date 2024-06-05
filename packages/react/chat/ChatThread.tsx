import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Markdown from "react-markdown";
import type { Chat } from "@reagentai/serve/chat";

import { AgentNodeUI } from "../agent/index.js";

const ChatThread = (props: {
  messages: Record<string, Chat.Message>;
  sortedMessageIds: string[];
  removeBottomPadding?: boolean;
}) => {
  let chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  let chatMessagesRef = useRef<HTMLDivElement>(null);
  const sortedMessages = useMemo(() => {
    return props.sortedMessageIds.map((id) => props.messages[id]);
  }, [props.messages, props.sortedMessageIds]);

  const sendNewMessage = {
    isIdle: false,
    isPending: false,
    isStreaming: false,
  };

  const [lastMessage, setLastMessage] = useState(null);
  useEffect(() => {
    // Note(sagar): scroll to the bottom. Need to do it after
    // the last message is rendered
    const containerHeight = parseFloat(
      getComputedStyle(chatMessagesRef.current!).height
    );
    chatMessagesContainerRef.current!.scrollTo(0, containerHeight + 100_000);
  }, [chatMessagesRef.current, chatMessagesContainerRef.current, lastMessage]);

  return (
    <div
      ref={chatMessagesContainerRef}
      className="h-full overflow-y-auto scroll:w-1 thumb:rounded thumb:bg-gray-400 space-y-6"
    >
      <div className="flex justify-center items-center">
        <div className="px-4 flex-1 min-w-[350px] max-w-[750px]">
          {props?.messages && (
            <div
              ref={chatMessagesRef}
              className={clsx(
                "chat-messages pt-2 text-sm text-accent-12/80 space-y-5",
                {
                  "pb-24": !Boolean(props.removeBottomPadding),
                }
              )}
            >
              {sortedMessages.map((message, index) => {
                const isLastMessage = index == sortedMessages.length - 1;
                // const message = props.messages[messageId];

                if (isLastMessage && lastMessage !== message) {
                  setLastMessage(message as any);
                }
                return (
                  <ChatMessage
                    key={index}
                    message={message}
                    showLoadingBar={sendNewMessage.isStreaming && isLastMessage}
                    showRole={
                      index == 0 ||
                      sortedMessages[index - 1].role != message.role
                    }
                  />
                );
              })}
              {sendNewMessage.isPending && !sendNewMessage.isIdle && (
                // !sendNewMessage.input.regenerate() &&
                <div>
                  <ChatMessage
                    // state={state}
                    // @ts-expect-error
                    message={sendNewMessage.input}
                    showRole={false}
                  />
                </div>
              )}
            </div>
          )}
          {/* <Show when={error()}>
                        <div class="py-4 text-center bg-red-50 text-red-700">
                            {error()?.message}
                        </div>
                    </Show> */}
        </div>
      </div>
    </div>
  );
};

const ChatMessage = (props: {
  message: Pick<Chat.Message, "id" | "message" | "role">;
  showRole: boolean;
  showLoadingBar?: boolean;
}) => {
  const markdownRef = useRef<HTMLDivElement>(null);
  const role = useMemo(() => {
    const id = props.message.role || "user";
    return {
      id,
      name: id == "ai" ? "AI" : id == "system" ? null : "User",
    };
  }, [props.message.role]);

  const isPending = false;
  return (
    <div
      className={clsx("chat-message flex flex-row w-full space-x-5", {
        "!mt-0": !props.showRole,
      })}
    >
      <div className="w-8">
        {props.showRole && role.name && (
          <div
            className={clsx(
              "mt-2 text-[0.6rem] font-medium leading-8 rounded-xl border select-none text-center text-gray-600",
              {
                "bg-[hsl(60_28%_95%)]": role.id == "user",
                "bg-brand-3": role.id == "ai",
              }
            )}
          >
            {role.name}
          </div>
        )}
      </div>
      <div
        className="flex-1 space-y-2 overflow-x-hidden"
        data-message-id={props.message.id}
      >
        {props.message.message.ui && (
          <div className="px-4 py-2">
            <AgentNodeUI {...props.message.message.ui!} />
          </div>
        )}
        {props.message.message.content && (
          <div
            ref={markdownRef}
            className={clsx(
              "message prose px-4 py-3 rounded-lg leading-6 select-text space-y-2",
              {
                "bg-[hsl(60_28%_95%)]": role.id == "user",
                "text-gray-800": role.id == "ai",
              }
            )}
            style={{ letterSpacing: "0.1px", wordSpacing: "1px" }}
          >
            <Markdown remarkPlugins={[]}>
              {props.message.message.content}
            </Markdown>
          </div>
        )}
        {/* <Show when={props.message.metadata.error!()}>
                    <div className="py-2 text-red-700">
                        <b>Error: </b>
                        {props.message.metadata.error!()}
                    </div>
                </Show> */}
        {/* <Show when={props.showLoadingBar || isPending()}>
                    <InProgressBar />
                </Show> */}
      </div>
    </div>
  );
};

// const SearchResults = (props: { searchResults: Chat.SearchResult[] }) => {
//     const [showSearchResults, setShowSearchResults] = useState(true);
//     return (
//         <div className="search-results">
//             <div
//                 className="px-2 py-1 flex font-semibold bg-gray-100 text-gray-600 rounded cursor-pointer space-x-2"
//                 onClick={() => {
//                     setShowSearchResults((prev) => !prev);
//                 }}
//             >
//                 <div className="py-1">
//                     <HiOutlinePaperClip size={12} />
//                 </div>
//                 <div className="flex-1">Found data related to your query</div>
//                 <div className="py-0.5">
//                     {showSearchResults ? <HiChevronUp size={14} /> : <HiChevronDown size={14} />}
//                 </div>
//             </div>
//             {showSearchResults &&
//                 <div className="py-1 bg-gray-100">
//                     {props.searchResults.map((result, index) => {
//                         return (
//                             <div key={index} className="px-8">
//                                 {result.files.length > 0 &&
//                                     <>
//                                         <div className="text-gray-700">Files</div>
//                                         <div className="ml-4">
//                                             <ul className="list-disc text-gray-600">
//                                                 {result.files.map((file, index) => {
//                                                     return (
//                                                         <li key={index} className="underline cursor-pointer">
//                                                             {file.name}
//                                                         </li>
//                                                     );
//                                                 })}
//                                             </ul>
//                                         </div>
//                                     </>
//                                 }
//                             </div>
//                         );
//                     })}
//                 </div>
//             }
//         </div>
//     );
// };

// const InProgressBar = () => {
//     return (
//         <div className="px-4 py-2 text-gray-800 space-y-1">
//             <div className="flex py-0 justify-center items-center space-x-4">
//                 <div className="flex-[0.2] h-1 bg-gray-300 rounded animate-pulse"></div>
//                 <div className="h-1 basis-1"></div>
//                 <div className="flex-1 h-1 bg-gray-300 rounded animate-pulse"></div>
//             </div>
//             <div className="flex py-0 justify-center items-center space-x-4">
//                 <div className="flex-1 h-1 bg-gray-300 rounded animate-pulse"></div>
//                 <div className="h-1 basis-2"></div>
//                 <div className="flex-[0.3] h-1 bg-gray-300 rounded animate-pulse"></div>
//             </div>
//             <div className="h-1 bg-gray-300 rounded animate-pulse"></div>
//         </div>
//     );
// };

export { ChatThread };
