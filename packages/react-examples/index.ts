import chat from "./chat.js";
import weather from "./weather/index.js";
import sql from "./sql/index.js";
import e2b from "./e2b.js";

const workflows = new Map([
  ["default", chat],
  ["weather", weather],
  ["sql", sql],
  ["e2b", e2b],
]);

export { workflows };
