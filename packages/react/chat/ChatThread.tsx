import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "zustand";
import clsx from "clsx";
import Markdown from "react-markdown";
import type { Chat } from "@reagentai/reagent/chat";

import { AgentNodeRenderer } from "./node.js";
import { ChatStore } from "./state.js";
import { useChatTheme } from "./theme.js";

const ChatThread = (props: {
  store: ChatStore;
  EmptyScreen?: () => React.ReactElement;
  Loader?: () => React.ReactElement;
}) => {
  const theme = useChatTheme();
  const { classNames } = theme;
  const { messages, sortedMessageIds, prompt, inflightRequest } = useStore(
    props.store
  );
  const sortedMessages = useMemo(() => {
    return sortedMessageIds.map((id) => messages[id]);
  }, [messages, sortedMessageIds]);

  let chatMessagesContainerRef = useRef<HTMLDivElement>(null);
  let chatMessagesRef = useRef<HTMLDivElement>(null);

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

  const EmptyScreen = memo(props.EmptyScreen ? props.EmptyScreen : () => <></>);

  useEffect(() => {
    scrollToBottom();
  }, [sortedMessages]);
  return (
    <div
      ref={chatMessagesContainerRef}
      className={clsx("chat-thread overflow-y-auto", classNames.thread)}
    >
      <div className="flex justify-center items-center">
        <div
          className={clsx(
            "chat-messages-container flex-1",
            classNames.messagesContainer
          )}
        >
          {sortedMessageIds.length == 0 && <EmptyScreen />}
          {sortedMessages.length > 0 && (
            <div
              ref={chatMessagesRef}
              className={clsx("chat-messages", classNames.messages)}
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
                    showRole={
                      index == 0 ||
                      sortedMessages[index - 1].role != message.role
                    }
                    theme={theme}
                  />
                );
              })}
              {props.Loader &&
                inflightRequest &&
                !inflightRequest.responseReceived && (
                  <ChatMessage
                    message={{
                      id: "loading",
                      role: "ai",
                      Loader: props.Loader,
                    }}
                    store={props.store}
                    showRole={true}
                    theme={theme}
                  />
                )}

              {prompt?.Component && (
                <ChatMessage
                  message={{
                    id: "prompt",
                    role: "ai",
                    prompt,
                  }}
                  store={props.store}
                  showRole={false}
                  theme={theme}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ChatMessage = (props: {
  message:
    | (Pick<Chat.Message, "id" | "message" | "ui" | "role" | "node"> & {
        Loader?: () => React.ReactElement;
        prompt?: undefined;
      })
    | {
        id: string;
        role: "ai";
        Loader?: () => React.ReactElement;
        prompt?: any;
        ui?: undefined;
        message?: undefined;
        node?: undefined;
      };
  store: ChatStore;
  showRole: boolean;
  theme: ReturnType<typeof useChatTheme>;
}) => {
  const theme = props.theme;
  const { classNames } = theme;
  const markdownRef = useRef<HTMLDivElement>(null);
  const role = useMemo(() => {
    const id = props.message.role || "user";
    return {
      id,
      name:
        id == "ai"
          ? theme.avatars.ai
          : id == "system"
            ? null
            : theme.avatars.user,
    };
  }, [props.message.role]);

  return (
    <div
      className={clsx(
        "chat-message-container group flex flex-row",
        classNames.messageContainer,
        {
          "!mt-0 pt-2": !props.showRole,
        }
      )}
      data-role={role.id}
    >
      <div
        className={clsx("role-container", role.id, classNames.roleContainer)}
        data-role={role.id}
      >
        {props.showRole && role.name && (
          <div
            className={clsx("role select-none text-center", classNames.role)}
          >
            {role.name}
          </div>
        )}
      </div>
      <div
        className={clsx(
          "chat-message flex-1 overflow-x-hidden",
          classNames.message
        )}
        data-message-id={props.message.id}
        data-role={role.id}
      >
        {props.message.Loader && (
          <div
            className={clsx("chat-message-loading", classNames.messageContent)}
            data-role={role.id}
          >
            {props.message.Loader()}
          </div>
        )}
        {props.message.ui && (
          <div className={clsx("chat-message-ui", classNames.messageUI)}>
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
                "chat-message-content prose select-text",
                classNames.messageContent
              )}
              data-role={role.id}
            >
              <Markdown remarkPlugins={[]}>
                {props.message.message!.content}
              </Markdown>
            </div>
          )
        }
        {props.message.prompt && (
          <props.message.prompt.Component {...props.message.prompt.props} />
        )}
      </div>
    </div>
  );
};

export { ChatThread };
