import chatAgent from "../demo-agents/chat.js";
import weatherAgent from "../demo-agents/weather.js";
import sqlAgent from "../demo-agents/sql/index.js";

const agents = new Map([
  ["default", chatAgent],
  ["weather", weatherAgent],
  ["sql", sqlAgent],
]);

export { agents };
