import {
  Observable,
  ReplaySubject,
  Subject,
  count,
  map,
  mergeMap,
  take,
} from "rxjs";
import { GraphAgent } from "@reagentai/reagent/agent/index.js";
import { uniqueId } from "@reagentai/reagent/utils/uniqueId.js";
import type { Chat } from "@reagentai/reagent/chat";

type OutputStream = Observable<any> & {
  toResponse(): Response;
};

const invokeGraphAgent = <I extends Record<string, unknown>>(
  agent: GraphAgent,
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

  const input = agent.getNode<void, I, I>(options.nodeId)!;
  const res = input.invoke(options.input);
  agent.output.ui
    .filter(res)
    .pipe(
      mergeMap((stream) => {
        let messageId = uniqueId();
        const createdAt = new Date();
        return stream.value.pipe(
          map((update: any) => {
            return {
              type: "message/ui/update" as const,
              data: {
                id: messageId,
                node: stream.node,
                ui: update.render,
                role: "ai",
                createdAt: createdAt.toISOString(),
              },
            };
          })
        );
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

  agent.output.markdownStream
    .filter(res)
    .pipe(
      mergeMap((stream) => {
        let messageId = uniqueId();
        const createdAt = new Date();
        return stream.value.pipe(
          map((data: any) => {
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

export { invokeGraphAgent };
