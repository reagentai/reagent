import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { HiOutlinePaperAirplane } from "react-icons/hi";
import { uniqueId } from "@reagentai/reagent/utils";

import { adjustTextareaHeight } from "../utils/textarea.js";
import { useChatTheme } from "./theme.js";

const Chatbox = (props: {
  isChatLocked: boolean;
  sendNewMessage: (msg: {
    id: string;
    message: { content: string };
    regenerate: boolean;
  }) => void;
  onFocus?: () => void;
}) => {
  const [message, setMessage] = useState("");
  let textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current?.focus();
    }
  }, [textareaRef.current]);

  const submitForm = () => {
    props.sendNewMessage({
      id: uniqueId(19),
      message: {
        content: message,
      },
      regenerate: false,
    });
    setMessage("");
    textareaRef.current?.focus();
  };

  const keydownHandler = (e: any) => {
    const value = e.target.value;
    if (
      e.key == "Enter" &&
      !e.shiftKey &&
      !props.isChatLocked &&
      value.trim().length > 0
    ) {
      submitForm();
      e.preventDefault();
      e.stopPropagation();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      adjustTextareaHeight(textareaRef.current, message);
    }
  }, [textareaRef.current, message]);

  const theme = useChatTheme();
  return (
    <div className={clsx("chatbox-container", theme.chatboxContainer)}>
      <div className={clsx("chatbox relative", theme.chatbox)}>
        <form
          className="flex p-0 m-0"
          onSubmit={(e) => {
            submitForm();
            e.preventDefault();
          }}
        >
          <textarea
            ref={textareaRef}
            placeholder="Send a message"
            className={clsx(
              "chatbox-textarea flex-1 resize-none",
              theme.chatboxTextarea
            )}
            value={message}
            onInput={(e: any) => setMessage(e.target.value)}
            onKeyDown={keydownHandler}
            onFocus={() => {
              props.onFocus?.();
            }}
          ></textarea>
          <div className={theme.chatboxButtonContainer}>
            <button
              className={clsx(
                "chatbox-button outline-none",
                theme.chatboxButton
              )}
              data-empty={message.trim().length == 0}
            >
              <HiOutlinePaperAirplane size="14px" className="rotate-90" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export { Chatbox };
