"use client";
import {
  ReagentChat,
  ChatThemeProvider,
  ChatStore,
} from "@reagentai/react/chat";
import { useChatTheme } from "@reagentai/react/chat/theme";
import { Loader, UserRound, Sparkle } from "lucide-react";

const ChatIsland = (props: {
  store: ChatStore;
  templates: any[];
  EmptyScreen: React.ReactNode;
}) => {
  const theme = useChatTheme();
  return (
    <ChatThemeProvider
      value={{
        classNames: {
          messageContent:
            theme.classNames.messageContent +
            " !px-3 !py-2 selection:bg-blue-300",
          messagesContainer: theme.classNames.messagesContainer + " !px-2",
          messages: theme.classNames.messages + " !pt-6 !space-y-3",
          roleContainer: theme.classNames.roleContainer + " !mr-2 !w-6",
          role:
            theme.classNames.role +
            " !mt-2 !border-0 group-has-[.user]:!border",
        },
        avatars: {
          ai: <Sparkle className="w-full h-full p-0.5" />,
          user: <UserRound className="w-full h-full p-0.5" />,
        },
      }}
    >
      <ReagentChat
        store={props.store}
        templates={props.templates}
        EmptyScreen={props.EmptyScreen}
        Loader={
          <div className="pt-0.5">
            <Loader className="w-4 h-4 animate-spin" />
          </div>
        }
      />
    </ChatThemeProvider>
  );
};

const EmptyScreen = () => {
  return (
    <div className="mt-8 mx-4 p-5 rounded-lg border border-gray-200 space-y-3 dark:border-gray-600">
      <div className="text-lg font-bold text-gray-800 dark:text-gray-300">
        Demo chatbot
      </div>
      <div className="text-sm text-gray-500 dark:text-gray-400">
        This is a demo chatbot.
      </div>
    </div>
  );
};

export { ChatIsland, EmptyScreen };
