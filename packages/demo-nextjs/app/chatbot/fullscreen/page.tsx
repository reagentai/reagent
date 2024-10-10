"use client";
import { useMemo } from "react";
import clsx from "clsx";
import { createChatStore } from "@reagentai/react/chat";
import { Trash } from "lucide-react";
import { ChatIsland, EmptyScreen } from "../chatbot";

export default function () {
  const minimized = false;
  const templates: any[] = [];
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

  return (
    <div className="relative h-screen w-screen">
      <div className="absolute h-screen w-screen">This is a demo webpage</div>
      <div className="chatbot w-full h-full flex flex-row justify-center">
        <div
          className={clsx("overlay relative w-full h-full", {
            "bg-gray-50 bg-opacity-45 backdrop-blur-sm": !minimized,
          })}
        ></div>
        <div className="absolute bottom-0 flex w-[600px] h-[600px] rounded shadow overflow-hidden bg-white dark:bg-gray-700 pointer-events-auto">
          <div className="flex flex-col flex-1 h-full ">
            <div className="py-1 px-3 flex justify-end text-center text-xs rounded border-b border-gray-200 dark:border-gray-600 text-gray-500 space-x-2">
              <Trash
                className="cursor-pointer w-3 h-3"
                onClick={() => {
                  store.getState().reset();
                }}
              />
            </div>
            <div className="w-[600px] h-[580px] flex-1">
              <ChatIsland
                EmptyScreen={<EmptyScreen />}
                store={store}
                templates={templates}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
