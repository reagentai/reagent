import { memo, useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { useStore } from "zustand";
import { HiOutlinePaperAirplane } from "react-icons/hi";
import { uniqueId } from "@reagentai/reagent/utils";

import { useChatTheme } from "../../theme.js";
import { useReagentChatContext } from "../../context.js";

const Chatbox = memo(() => {
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
      node: {
        id: "input",
      },
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
    if (textareaRef.current && textareaRef.current.scrollHeight > 0) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [textareaRef.current, message]);

  const { classNames: theme } = useChatTheme();
  return (
    <div className={clsx("chatbox-container", theme.chatboxContainer)}>
      <form
        className={clsx("chatbox relative flex", theme.chatbox)}
        onSubmit={(e) => {
          submitForm();
          e.preventDefault();
        }}
      >
        <textarea
          ref={textareaRef}
          rows={1}
          placeholder="Send a message"
          className={clsx(
            "chatbox-textarea flex-1 my-auto resize-none",
            theme.chatboxTextarea
          )}
          value={message}
          onInput={(e: any) => setMessage(e.target.value)}
          onKeyDown={keydownHandler}
        ></textarea>
        <div className={clsx("flex items-end", theme.chatboxButtonContainer)}>
          <button
            className={clsx("chatbox-button outline-none", theme.chatboxButton)}
            data-empty={message.trim().length == 0}
          >
            <HiOutlinePaperAirplane size="14px" className="rotate-90" />
          </button>
        </div>
      </form>
    </div>
  );
});

export { Chatbox };
