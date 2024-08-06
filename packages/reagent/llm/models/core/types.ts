import { InvokeConfig } from "../../core/executor.js";
import { FormattedChatMessage } from "../../prompt/index.js";

export type ModelInvokeOptions = InvokeConfig & {
  messages: FormattedChatMessage[];
  tools: any[];
};
