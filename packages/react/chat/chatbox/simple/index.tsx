import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useStore } from "zustand";
import { HiOutlinePaperAirplane } from "react-icons/hi";
import { uniqueId } from "@reagentai/reagent/utils";

import { adjustTextareaHeight } from "../../../utils/textarea.js";
import { useChatTheme } from "../../theme.js";
import { useReagentChatContext } from "../../Chat.js";

const Chatbox = () => {
  const { store } = useReagentChatContext();
  const { invoke } = useStore(store);
  const [message, setMessage] = useState("");
  let textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current?.focus();
    }
  }, [textareaRef.current]);

  const submitForm = () => {
    invoke({
      nodeId: "input",
      input: {
        id: uniqueId(19),
        query: message,
        regenerate: false,
      },
    });
    setMessage("");
    textareaRef.current?.focus();
  };

  const keydownHandler = (e: any) => {
    const value = e.target.value;
    if (e.key == "Enter" && !e.shiftKey && value.trim().length > 0) {
      submitForm();
      e.preventDefault();
    }
    if (!e.metaKey) {
      e.stopPropagation();
    }
  };

  useEffect(() => {
    if (textareaRef.current) {
      adjustTextareaHeight(textareaRef.current, message);
    }
  }, [textareaRef.current, message]);

  const { classNames: theme } = useChatTheme();
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
          ></textarea>
          <div className={clsx("flex items-end", theme.chatboxButtonContainer)}>
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