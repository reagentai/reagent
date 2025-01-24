import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useStore } from "zustand";
import clsx from "clsx";
import Markdown, { Components as MarkdownComponents } from "react-markdown";
import type { Chat } from "@reagentai/reagent/chat";
import * as duration from "human-duration";

import { AgentNodeRenderer } from "./node.js";
import { ChatStore } from "./state.js";
import { useChatTheme } from "./theme.js";

type MarkdownOptions = {
  remarkPlugins?: any[];
  components?: Partial<MarkdownComponents>;
};

const ChatThread = memo(
  (props: {
    store: ChatStore;
    smoothScroll?: boolean;
    EmptyScreen?: React.ReactNode;
    Loader?: React.ReactNode;
    markdown?: MarkdownOptions;
  }) => {
    let scrolledToBottom = useRef(false);
    let chatMessagesContainerRef = useRef<HTMLDivElement>(null);
    let chatMessagesRef = useRef<HTMLDivElement>(null);
    const theme = useChatTheme();
    const { classNames } = theme;

    const scrollToBottom = useCallback(() => {
      if (chatMessagesRef.current && chatMessagesContainerRef.current) {
        const containerHeight = parseFloat(
          getComputedStyle(chatMessagesRef.current!).height
        );
        if (Number.isNaN(containerHeight)) {
          return;
        }
        scrolledToBottom.current = true;
        chatMessagesContainerRef.current!.scrollTo({
          top: containerHeight + 100_000,
          left: 0,
          behavior: props.smoothScroll ? "smooth" : "instant",
        });
      }
    }, []);

    useEffect(() => {
      if (!scrolledToBottom.current) {
        // use timeout to allow hidden chat container to render
        // and set computed height
        setTimeout(() => {
          scrollToBottom();
        }, 200);
      }
    });
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
            <EmptyScreen store={props.store} EmptyScreen={props.EmptyScreen} />
            <div
              ref={chatMessagesRef}
              className={clsx("chat-messages", classNames.messages)}
            >
              <ChatMessages
                store={props.store}
                scrollToBottom={scrollToBottom}
                Loader={props.Loader}
                markdown={props.markdown}
              />
              <PromptComponent
                store={props.store}
                scrollToBottom={scrollToBottom}
              />
              <Error store={props.store} />
            </div>
          </div>
        </div>
      </div>
    );
  }
);

const EmptyScreen = (props: {
  store: ChatStore;
  EmptyScreen?: React.ReactNode;
}) => {
  const { sortedMessageIds } = useStore(props.store);
  return <>{sortedMessageIds.length == 0 && props.EmptyScreen}</>;
};

const Error = (props: { store: ChatStore }) => {
  const { error } = useStore(props.store);
  return (
    <>
      {error && (
        <div className="error px-4 py-3 text-center text-red-700 overflow-hidden text-ellipsis">
          Error sending message: {error}
        </div>
      )}
    </>
  );
};

const ChatMessages = memo(
  (props: {
    store: ChatStore;
    scrollToBottom: () => void;
    Loader?: React.ReactNode;
    markdown?: MarkdownOptions;
  }) => {
    const theme = useChatTheme();
    const { messages, sortedMessageIds, inflightRequest, prompt } = useStore(
      props.store
    );
    const sortedMessages = useMemo(() => {
      return sortedMessageIds.map((id) => messages[id]);
    }, [messages, sortedMessageIds]);

    const [lastMessage, setLastMessage] = useState(null);
    useEffect(() => {
      props.scrollToBottom();
    }, [sortedMessages]);

    return (
      <>
        {sortedMessages.length > 0 &&
          sortedMessages.map((message, index) => {
            const isLastMessage = index == sortedMessages.length - 1;
            if (isLastMessage && lastMessage !== message) {
              setLastMessage(message as any);
              props.scrollToBottom();
            }
            return (
              <ChatMessage
                key={message.id}
                message={message}
                store={props.store}
                showRole={
                  index == 0 || sortedMessages[index - 1].role != message.role
                }
                theme={theme}
                markdown={props.markdown}
              />
            );
          })}
        {props.Loader &&
          inflightRequest &&
          !inflightRequest.responseReceived &&
          !(prompt && prompt.props.requiresUserInput) && (
            <ChatMessage
              message={{
                id: "loading",
                role: "ai",
                Loader: props.Loader,
              }}
              store={props.store}
              showRole={true}
              theme={theme}
              markdown={props.markdown}
            />
          )}
      </>
    );
  }
);

const PromptComponent = memo(
  (props: { store: ChatStore; scrollToBottom: () => void }) => {
    const prompt = useStore(props.store, (s) => s.prompt);

    const theme = useChatTheme();
    const message = useMemo(() => {
      return {
        id: "prompt",
        role: "ai",
        prompt,
      };
    }, [prompt]);

    useEffect(() => {
      props.scrollToBottom();
    }, [prompt]);

    if (!prompt?.Component) {
      return null;
    }
    return (
      <ChatMessage
        message={message as any}
        store={undefined!}
        showRole={prompt.props.requiresUserInput}
        theme={theme}
      />
    );
  }
);

const ChatMessage = memo(
  (props: {
    message:
      | (Chat.Message & {
          Loader?: React.ReactNode;
          prompt?: undefined;
        })
      | {
          id: string;
          role: "ai";
          Loader?: React.ReactNode;
          prompt?: any;
          ui?: undefined;
          message?: undefined;
          node?: undefined;
          createdAt?: undefined;
        };
    store: ChatStore;
    showRole: boolean;
    theme: ReturnType<typeof useChatTheme>;
    markdown?: MarkdownOptions;
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
              className={clsx(
                "chat-message-loading",
                classNames.messageContent
              )}
              data-role={role.id}
            >
              {props.message.Loader}
            </div>
          )}
          {props.message.ui &&
            props.message.ui.map((ui, index) => (
              <div
                className="chat-message-ui group/message relative"
                key={index}
              >
                {props.message.createdAt && (
                  <CreatedAtTooltip createdAt={props.message.createdAt} />
                )}
                <AgentNodeRenderer
                  messageId={props.message.id}
                  store={props.store}
                  node={props.message.node}
                  ui={ui}
                />
              </div>
            ))}
          {
            // node isn't set for user message
            (Boolean(props.message.message) ||
              props.message.node?.type == "@core/chat-completion") && (
              <div
                ref={markdownRef}
                className={clsx(
                  "chat-message-content group/message relative prose select-text",
                  classNames.messageContent
                )}
                data-role={role.id}
              >
                {props.message.createdAt && (
                  <CreatedAtTooltip createdAt={props.message.createdAt} />
                )}
                <Markdown
                  remarkPlugins={props.markdown?.remarkPlugins}
                  components={props.markdown?.components}
                >
                  {props.message.message!.content}
                </Markdown>
              </div>
            )
          }
          {props.message.prompt && (
            <props.message.prompt.Component
              {...props.message.prompt.props}
              React={{
                useContext,
                useEffect,
                useMemo,
              }}
            />
          )}
        </div>
      </div>
    );
  }
);

const CreatedAtTooltip = (props: { createdAt: string }) => {
  return (
    <div className="select-none opacity-0 group-hover/message:opacity-100 absolute right-0 bottom-0 px-2 py-0.5 text-xs rounded-md bg-gray-900/70 text-gray-200 transition ease-in delay-500 duration-200">
      {duration
        .fmt(Date.now() - new Date(props.createdAt).getTime())
        .grading([duration.day, duration.hour, duration.minute])
        .segments(2)}{" "}
      ago
    </div>
  );
};

export { ChatThread };
export type { MarkdownOptions };
