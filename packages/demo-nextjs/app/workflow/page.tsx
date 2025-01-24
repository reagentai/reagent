"use client";
import { useCallback, useMemo, useRef, useState } from "react";
import { createWorkflowClient } from "@reagentai/client/workflow";

import * as workflow from "./workflow";
import { ReagentContextProvider } from "@reagentai/react/workflow";

export default function () {
  const [prompt, setPrompt] = useState<
    { Component: any; props: any } | undefined
  >();

  const [idle, setIdle] = useState(true);
  const hasPendingTasks = useRef(false);
  const client = useMemo(() => {
    const client = createWorkflowClient({
      http: {
        url: "/api/chat",
      },
      templates: workflow.nodes,
      showPrompt(options) {
        setPrompt(options);
      },
      autoRunPendingTasks: false,
      middleware: {
        onPendingTasks(tasks) {
          hasPendingTasks.current =
            tasks.pendingExecutions.length > 0 ||
            tasks.pendingPrompts.length > 0;
          console.log("TASKS =", tasks);
          setTimeout(() => {
            console.log("resuming pending tasks...");
            client.resumePendingTasks(tasks);
          }, 1_000);
        },
      },
    });

    client.subscribe({
      onStatusUpdate(status) {
        setIdle(status.idle && !hasPendingTasks.current);
      },
      complete() {
        console.log("WORKFLOW COMPLETED");
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
            {!idle ? "Running workflow" : "RUN workflow"}
          </button>
        </div>
        <div>{prompt && <prompt.Component {...prompt.props} />}</div>
      </div>
    </ReagentContextProvider>
  );
}
