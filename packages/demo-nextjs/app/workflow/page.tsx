"use client";
import { useCallback, useMemo, useState } from "react";
import { createWorkflowClient } from "@reagentai/client/workflow";

import * as workflow from "./workflow";
import { ReagentContextProvider } from "@reagentai/react/workflow";

export default function () {
  const [prompt, setPrompt] = useState<
    { Component: any; props: any } | undefined
  >();
  const client = useMemo(() => {
    const client = createWorkflowClient({
      http: {
        url: "/api/chat",
      },
      templates: workflow.nodes,
      showPrompt(options) {
        setPrompt(options);
      },
    });

    client.subscribe({
      complete() {
        console.log("WORKFLOW DONE");
      },
    });
    return client;
  }, []);

  const triggerWorkflow = useCallback(async () => {
    const run = client.start({
      nodeId: "input",
      input: {},
    });
  }, []);
  return (
    <ReagentContextProvider templates={workflow.nodes}>
      <div className="flex flex-col">
        <div>
          <button
            type="button"
            onClick={() => {
              triggerWorkflow();
            }}
            className="flex px-3 py-1 border border-indigo-400 bg-indigo-100 rounded"
          >
            RUN workflow
          </button>
        </div>
        <div>{prompt && <prompt.Component {...prompt.props} />}</div>
      </div>
    </ReagentContextProvider>
  );
}
