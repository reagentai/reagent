import { createContext, useContext } from "react";
import deepmerge from "deepmerge";

type ChatTheme = {
  classNames: {
    thread: string;
    messagesContainer: string;
    messages: string;
    roleContainer: string;
    role: string;
    messageContainer: string;
    message: string;
    messageUI: string;
    messageContent: string;
    chatboxContainer: string;
    chatbox: string;
    chatboxTextarea: string;
    chatboxButtonContainer: string;
    chatboxButton: string;
    timestampTooltip: string;
  };
  avatars: {
    ai: React.ReactNode;
    user: React.ReactNode;
  };
};

const defaultTheme: ChatTheme = {
  classNames: {
    thread: "h-full space-y-6",
    messagesContainer: "min-w-[350px] max-w-[750px] px-4 text-sm",
    messages: "pt-2 space-y-4 pb-24",
    roleContainer: "w-8 mr-5",
    role: "mt-2 text-[0.6rem] font-medium leading-8 rounded border overflow-hidden dark:border-gray-400 text-gray-600 dark:text-gray-300",
    messageContainer: "w-full",
    message: "",
    messageUI: "px-4 py-2",
    messageContent:
      "px-4 py-3 rounded-lg leading-6 space-y-2 tracking-[0.1px] group-has-[.user]:bg-[hsl(60_28%_95%)] dark:group-has-[.user]:bg-gray-600 dark:data-[role=user]:text-gray-100 dark:data-[role=ai]:text-gray-200",
    chatboxContainer: "min-w-[200px] max-w-[750px] space-y-1 rounded-md",
    chatbox:
      "px-2 py-2 max-h-[180px] overflow-y-auto rounded-lg bg-gray-50 dark:bg-gray-500 border border-gray-200 dark:border-gray-500 shadow-sm",
    chatboxTextarea:
      "px-2 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none focus:outline-none placeholder:text-gray-500 dark:placeholder:text-gray-300",
    chatboxButtonContainer:
      "sticky top-0 flex px-2 pt-1 h-[inherit] max-h-[inherit] items-end",
    chatboxButton:
      "p-1 rounded text-white bg-indigo-500 data-[empty=true]:text-gray-500 data-[empty=true]:bg-indigo-200",
    timestampTooltip: "",
  },
  avatars: {
    ai: "AI",
    user: "User",
  },
};

const ChatThemeContext = createContext<ChatTheme>(defaultTheme);
const useChatTheme = () => useContext(ChatThemeContext)!;

const ChatThemeProvider = (props: {
  value: {
    classNames?: Partial<ChatTheme["classNames"]>;
    avatars?: ChatTheme["avatars"];
  };
  children: any;
}) => {
  const theme = deepmerge(defaultTheme, props.value) as ChatTheme;
  return (
    <ChatThemeContext.Provider value={theme}>
      {props.children}
    </ChatThemeContext.Provider>
  );
};

export { useChatTheme, ChatThemeProvider };
