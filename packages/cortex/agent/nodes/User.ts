import { Observable, ReplaySubject, Subject, concatMap } from "rxjs";

import { z, AbstractAgentNode, Context } from "../";
import { AtLeastOne } from "../types";

const config = z.object({});

const inputSchema = z.object({
  markdownStream: z.instanceof(Observable).label("Markdown stream"),
});

const output = z.object({
  markdownStream: z.instanceof(Observable).label("Markdown stream"),
});

class User extends AbstractAgentNode<
  typeof config,
  typeof inputSchema,
  typeof output
> {
  #stream: Subject<any>;
  #subjectStreams: Observable<any>[];
  constructor() {
    super();
    this.#subjectStreams = [];
    this.#stream = new ReplaySubject();
  }

  get metadata() {
    return {
      id: "@core/user",
      version: "0.0.1",
      name: "User",
      config,
      input: inputSchema,
      output,
    };
  }

  init(context: Context<z.infer<typeof config>, z.infer<typeof output>>) {
    context.sendOutput({
      markdownStream: this.#stream.pipe(
        concatMap(() => this.#subjectStreams.pop()!)
      ),
    });
  }

  onInputEvent(
    context: Context<z.infer<typeof config>, z.infer<typeof output>>,
    data: AtLeastOne<z.infer<typeof inputSchema>>
  ) {
    if (data.markdownStream) {
      this.#subjectStreams.push(data.markdownStream);
      this.#stream.next(0);
    }
  }

  async *run(
    context: Context<z.infer<typeof config>, z.infer<typeof output>>,
    input: z.infer<typeof inputSchema>
  ) {
    if (input.markdownStream) {
      this.#subjectStreams.push(input.markdownStream);
      this.#stream.next(0);
    }
  }
}

export default User;
