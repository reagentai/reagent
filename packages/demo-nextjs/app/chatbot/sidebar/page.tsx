"use client";
import { useMemo } from "react";
import clsx from "clsx";
import { createChatStore } from "@reagentai/react/chat";
import { Trash } from "lucide-react";
import { useStore } from "zustand";

import { ChatIsland, EmptyScreen } from "../chatbot";

export default function () {
  const width = 500;
  const position: string = "left";
  const store = useMemo(
    () =>
      createChatStore(
        {
          messages: {},
          url: "/api/chat",
          templates: [],
        },
        {
          persistKey: `demo-nextjs`,
        }
      ),
    []
  );

  const { sortedMessageIds, reset } = useStore(store);
  return (
    <div
      className={clsx(
        "absolute bottom-0 flex h-screen shadow overflow-hidden bg-white dark:bg-gray-700 pointer-events-auto",
        {
          "left-0": position == "left",
          "right-0": position == "right",
        }
      )}
      style={{ width }}
    >
      <div className="flex flex-col flex-1 h-full ">
        <div className="py-1 px-3 h-8 flex justify-between items-center text-center text-xs dark:border-gray-600 shadow text-gray-800 dark:text-gray-300 space-x-2">
          <div className="flex text-xs font-bold space-x-1">
            <div>Copilot</div>
          </div>
          {sortedMessageIds.length > 0 && (
            <Trash className="text-gray-500 cursor-pointer" onClick={reset} />
          )}
        </div>
        <div className="flex-1 overflow-auto" style={{ width }}>
          <ChatIsland
            EmptyScreen={<EmptyScreen />}
            store={store}
            templates={[]}
          />
        </div>
      </div>
    </div>
  );
}
