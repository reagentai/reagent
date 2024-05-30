import chatAgent from "../demo-agents/chat";
import weatherAgent from "../demo-agents/weather";

const agents = new Map([
  ["default", chatAgent],
  ["weather", weatherAgent],
]);

export { agents };
