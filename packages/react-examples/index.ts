import chatAgent from "./chat.js";
import weatherAgent from "./weather/index.js";
import sqlAgent from "./sql/index.js";
import e2b from "./e2b.js";

const agents = new Map([
  ["default", chatAgent],
  ["weather", weatherAgent],
  ["sql", sqlAgent],
  ["e2b", e2b],
]);

export { agents };
