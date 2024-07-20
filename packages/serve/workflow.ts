import {
  Observable,
  ReplaySubject,
  Subject,
  count,
  map,
  mergeMap,
  take,
} from "rxjs";
import { Workflow } from "@reagentai/reagent/workflow.js";
import { uniqueId } from "@reagentai/reagent/utils/uniqueId.js";
import type { Chat } from "@reagentai/reagent/chat";

type OutputStream = Observable<any> & {
  toResponse(): Response;
};

const runReagentWorkflow = <I extends Record<string, unknown>>(
  workflow: Workflow,
  options: {
    nodeId: string;
    input: I;
  }
) => {
  const agentOutputStream = new ReplaySubject<Chat.Response>();
  const completionSubject = new Subject();
  completionSubject
    .pipe(take(2))
    .pipe(count())
    .subscribe(() => {
      agentOutputStream.complete();
    });

  const run = workflow.run({
    nodeId: options.nodeId,
    input: options.input,
  });
  run.output.ui
    .pipe(
      map(({ node, value }) => {
        const createdAt = new Date();
        return {
          type: "message/ui/update" as const,
          data: {
            id: run.id + "-" + node.id,
            node,
            ui: value,
            role: "ai",
            createdAt: createdAt.toISOString(),
          },
        };
      })
    )
    .subscribe({
      next(output: any) {
        agentOutputStream.next(output);
      },
      complete() {
        completionSubject.next(1);
      },
      error(err: any) {
        console.error(err);
      },
    });

  run.output.markdownStream
    .pipe(
      mergeMap((stream) => {
        let messageId = uniqueId();
        const createdAt = new Date();
        return stream.value.pipe(
          map((data) => {
            return {
              type: "message/content/delta" as const,
              data: {
                id: messageId,
                node: stream.node,
                message: {
                  content: data.delta,
                },
                role: "ai",
                createdAt: createdAt.toISOString(),
              },
            };
          })
        );
      })
    )
    .subscribe({
      next(data: any) {
        agentOutputStream.next(data);
      },
      complete() {
        completionSubject.next(1);
      },
    });

  return Object.assign(agentOutputStream, {
    toResponse() {
      const self = this;
      const responseStream = new ReadableStream({
        async start(controller) {
          self.subscribe({
            next(data) {
              try {
                controller.enqueue("data: " + JSON.stringify(data) + "\n\n");
              } catch (e) {
                console.error("Error sending message to stream:", e);
              }
            },
            complete() {
              try {
                controller.close();
              } catch (e) {
                console.error("Error closing stream:", e);
              }
            },
          });
        },
      });

      return new Response(responseStream, {
        status: 200,
        headers: [["Content-Type", "text/event-stream"]],
      });
    },
  } as OutputStream);
};

export { runReagentWorkflow };
