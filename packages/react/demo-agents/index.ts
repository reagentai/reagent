import chatAgent from "../demo-agents/chat";
import weatherAgent from "../demo-agents/weather";
import sqlAgent from "../demo-agents/sql";

const agents = new Map([
  ["default", chatAgent],
  ["weather", weatherAgent],
  ["sql", sqlAgent],
]);

export { agents };
