import chatAgent from "./chat.js";
import weatherAgent from "./weather/index.js";
import sqlAgent from "./sql/index.js";

const agents = new Map([
  ["default", chatAgent],
  ["weather", weatherAgent],
  ["sql", sqlAgent],
]);

export { agents };
