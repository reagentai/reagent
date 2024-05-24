import { Observable, ReplaySubject, Subject } from "rxjs";

import { z, AbstractAgentNode, Context } from "../";
import { AtLeastOne } from "../types";

const config = z.void();

const inputSchema = z.object({
  markdown: z.string(),
  markdownStream: z.instanceof(Observable<any>).label("Markdown stream"),
});

const output = z.object({
  markdown: z.string(),
  markdownStream: z.instanceof(Observable<any>).label("Markdown stream"),
});

class User extends AbstractAgentNode<
  z.infer<typeof config>,
  z.infer<typeof inputSchema>,
  z.infer<typeof output>
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
      config: z.object({}),
      input: inputSchema,
      output,
    };
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
    _context: Context<z.infer<typeof config>, z.infer<typeof output>>,
    input: z.infer<typeof inputSchema>
  ) {
    yield input;
  }
}

export default User;
