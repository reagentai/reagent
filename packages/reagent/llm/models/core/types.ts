import { InvokeConfig } from "../../core/executor";
import { FormattedChatMessage } from "../../prompt";

export type ModelInvokeOptions = InvokeConfig & {
  messages: FormattedChatMessage[];
  tools: any[];
};
