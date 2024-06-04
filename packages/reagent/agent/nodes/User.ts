import { Observable } from "rxjs";

import { z, AbstractAgentNode, Context } from "../index.js";
import type { AtLeastOne } from "../types";

const config = z.void();

const inputSchema = z.object({
  markdown: z.string(),
  markdownStream: z.instanceof(Observable<any>).label("Markdown stream"),
  ui: z
    .custom<
      Observable<{
        node: { id: string; type: string; version: string };
        render: { step: string; data: any };
      }>
    >()
    .optional()
    .label("UI"),
});

const output = inputSchema.required();

class User extends AbstractAgentNode<
  z.infer<typeof config>,
  z.infer<typeof inputSchema>,
  z.infer<typeof output>
> {
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
    input: AtLeastOne<z.infer<typeof inputSchema>>
  ) {
    // send input data as output here because the user doesn't need
    // all inputs bound to it; for example, a ui node might be bound
    // but user should be able to use markdown stream even when ui
    // input isn't received
    context.sendOutput(input);
  }

  async *execute(
    _context: Context<z.infer<typeof config>, z.infer<typeof output>>,
    _input: z.infer<typeof inputSchema>
  ) {
    // since output events are sent during onInputEvent,
    // don't need to send here
  }
}

export default User;
