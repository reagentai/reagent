import { createContext, useContext } from "react";
import { BaseReagentNodeOptions } from "@reagentai/reagent";

import { ChatStore } from "./state";
import { MarkdownOptions } from "./ChatThread";

type ReagentChatContext = {
  store: ChatStore;
  templatesById: Record<
    string,
    BaseReagentNodeOptions<any, any, any> & { components: [] }
  >;
  EmptyScreen?: React.ReactNode;
  Loader?: React.ReactNode;
  ChatBox?: React.ReactNode;
  markdown?: MarkdownOptions;
};

const ReagentChatContext = createContext<ReagentChatContext>({} as any);

const useReagentChatContext = () => useContext(ReagentChatContext)!;

export { ReagentChatContext, useReagentChatContext };
