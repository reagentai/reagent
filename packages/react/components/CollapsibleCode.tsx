import React from "react";
import Markdown from "react-markdown";
// @ts-expect-error
import * as Collapsible from "@radix-ui/react-collapsible";
import { ChevronDownIcon, ChevronUpIcon } from "@radix-ui/react-icons";

const CollapsibleCode = (props: {
  title: JSX.Element;
  language: string;
  code: string;
}) => {
  const [open, setOpen] = React.useState(false);
  return (
    <Collapsible.Root className="w-full" open={open} onOpenChange={setOpen}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Collapsible.Trigger asChild>
          <button className="flex items-center text-gray-700 text-[15px] leading-[25px]">
            {props.title}
            {open ? <ChevronUpIcon /> : <ChevronDownIcon />}
          </button>
        </Collapsible.Trigger>
      </div>

      <Collapsible.Content>
        <div className="text-[15px] leading-[25px] rounded bg-slate-600 text-gray-50 my-[10px] p-[10px]">
          {/* TODO: use syntax highlighting */}
          <Markdown remarkPlugins={[]}>
            {"```" + props.language + `\n${props.code}\n`}
          </Markdown>
        </div>
      </Collapsible.Content>
    </Collapsible.Root>
  );
};

export { CollapsibleCode };
