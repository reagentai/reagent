import { useEffect, useMemo, useRef, useState } from "react";
import clsx from "clsx";
import Markdown from "react-markdown";
import type { Chat } from "@reagentai/reagent/chat";

import { AgentNodeRenderer } from "./node.js";
import { ChatStore } from "./state.js";

const ChatThread = (props: {
  store: ChatStore;
  removeBottomPadding?: boolean;
}) => {
  const messages = props.store((s) => s.messages);
  const sortedMessageIds = props.store((s) => s.sortedMessageIds);
  const sortedMessages = useMemo(() => {
    return sortedMessageIds.map((id) => messages[id]);
  }, [messages, sortedMessageIds]);

  let chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  let chatMessagesRef = useRef<HTMLDivElement>(null);

  const sendNewMessage = {
    isIdle: false,
    isPending: false,
    isStreaming: false,
  };

  const [lastMessage, setLastMessage] = useState(null);
  const scrollToBottom = () => {
    if (chatMessagesRef.current && chatMessagesContainerRef.current) {
      const containerHeight = parseFloat(
        getComputedStyle(chatMessagesRef.current!).height
      );
      chatMessagesContainerRef.current!.scrollTo({
        top: containerHeight + 100_000,
        left: 0,
        behavior: "smooth",
      });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, []);

  return (
    <div
      ref={chatMessagesContainerRef}
      className="h-full overflow-y-auto scroll:w-1 thumb:rounded thumb:bg-gray-400 space-y-6"
    >
      <div className="flex justify-center items-center">
        <div className="px-4 flex-1 min-w-[350px] max-w-[750px]">
          {messages && (
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

                if (isLastMessage && lastMessage !== message) {
                  setLastMessage(message as any);
                  scrollToBottom();
                }
                return (
                  <ChatMessage
                    key={index}
                    message={message}
                    store={props.store}
                    showLoadingBar={sendNewMessage.isStreaming && isLastMessage}
                    showRole={
                      index == 0 ||
                      sortedMessages[index - 1].role != message.role
                    }
                  />
                );
              })}
              {sendNewMessage.isPending && !sendNewMessage.isIdle && (
                <div>
                  <ChatMessage
                    // @ts-expect-error
                    message={sendNewMessage.input}
                    store={props.store}
                    showRole={false}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatMessage = (props: {
  message: Pick<Chat.Message, "id" | "message" | "ui" | "role" | "node">;
  store: ChatStore;
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
        {props.message.ui && (
          <div className="px-4 py-2">
            <AgentNodeRenderer
              messageId={props.message.id}
              store={props.store}
              node={props.message.node}
              render={props.message.ui!}
            />
          </div>
        )}
        {
          // node isn't set for user message
          (Boolean(props.message.message) ||
            props.message.node?.type == "@core/chat-completion") && (
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
                {props.message.message!.content}
              </Markdown>
            </div>
          )
        }
      </div>
    </div>
  );
};

export { ChatThread };
