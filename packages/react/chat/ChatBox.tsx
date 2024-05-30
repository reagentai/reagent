import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { HiOutlinePaperAirplane } from "react-icons/hi";
import { uniqueId } from "@reagentai/reagent/utils/uniqueId";

import { adjustTextareaHeight } from "../utils/textarea";

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

  return (
    <div className="chat-box min-w-[200px] max-w-[750px] space-y-1 rounded-md">
      <div className="relative px-2 py-2 rounded-lg bg-gray-50 border border-gray-200 shadow-sm">
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
            className="flex-1 py-1 max-h-[180px] px-2 text-sm text-gray-800 bg-transparent outline-none focus:outline-none resize-none placeholder:text-gray-500"
            style={{
              // @ts-expect-error
              "--uikit-scrollbar-w": "3px",
              "--uikit-scrollbar-track-bg": "transparent",
              "--uikit-scrollbar-track-thumb": "rgb(210, 210, 210)",
            }}
            value={message}
            onInput={(e: any) => setMessage(e.target.value)}
            onKeyDown={keydownHandler}
            onFocus={() => {
              props.onFocus?.();
            }}
          ></textarea>
          <div className="px-2 pt-1">
            <button
              className={clsx("p-1  rounded outline-none", {
                "text-white bg-indigo-500": message.trim().length > 0,
                "text-gray-500 bg-indigo-200": message.trim().length == 0,
              })}
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
