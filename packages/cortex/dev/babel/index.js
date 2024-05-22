import createClientBabelPlugin from "./client-plugin.js";
import createServerBabelPlugin from "./server-plugin.js";

/**
 * @typedef Options
 * @type {object}
 *
 * @property {boolean} ssr - set this to true to transpile for server
 */

/**
 *
 * @param {Options} options
 * @returns
 */

function createPlugin(options) {
  if (options.ssr) {
    return createServerBabelPlugin();
  } else {
    return createClientBabelPlugin();
  }
}

export default createPlugin;
