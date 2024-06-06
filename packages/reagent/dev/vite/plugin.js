import { transformSync, DEFAULT_EXTENSIONS } from "@babel/core";
import { once } from "lodash-es";
// @ts-expect-error
import picomatch from "picomatch";

import createBabelPlugin from "../babel/index.js";

function cleanUrl(url) {
  const queryRE = /\?.*$/s;
  const hashRE = /#.*$/s;
  return url.replace(hashRE, "").replace(queryRE, "");
}

const filterRegex = new RegExp(
  `\\.(${[...DEFAULT_EXTENSIONS, "tsx", "ts"].join("|").replace(/\./g, "")})$`
);

const warnToolsConfigMissing = once(() => {
  console.warn(`"tools" option missing from Reagent plugin config`);
});
/**
 * @typedef Options
 * @type {object}
 *
 * @property {boolean} [ssr] - set this to true to transpile files for frontend
 * @property {string[]} [tools] - absolute paths to the Agent tools.
 * @property {string[]} [include] - glob pattern to include files
 * @property {string[]} [exclude] - glob pattern to exclude files; include takes precedence
 * This can either be path to individual paths or paths to the directory
 * where the tools are located. This must be provided for the tools to be
 * compiled properly. Narrowing this path could speed up build.
 * @property {any[]} [presets] - babel presets
 * @property {((options: {ssr: boolean}) => any)[]} [plugins] - babel plugins
 */

/**
 *
 * @param {Options} options
 * @returns
 */
const createPlugin = (options = {}) => {
  const toolsPath = options.tools;
  if (!toolsPath) {
    warnToolsConfigMissing();
  }
  const shouldInclude = picomatch(options.include || [], {
    dot: true,
  });
  const shouldExclude = picomatch(options.exclude || [], {
    dot: true,
  });
  return {
    name: "vite-plugin-portal-reagent",
    transform(code, id, transformOptions) {
      if (!transformOptions && options.ssr == undefined) {
        throw new Error(
          `expected valid "options" argument in vite "transform" method`
        );
      }
      const filepath = cleanUrl(id);
      if (
        (toolsPath && !toolsPath.find((tp) => filepath.startsWith(tp))) ||
        !filterRegex.test(filepath) ||
        (!shouldInclude(filepath) && shouldExclude(filepath))
      ) {
        return;
      }

      const babelOptions = {
        ssr: options.ssr || transformOptions?.ssr,
      };
      const { code: transformedCode, map } = transformSync(code, {
        configFile: false,
        babelrc: false,
        filename: id,
        sourceFileName: filepath,
        plugins: [
          createBabelPlugin(babelOptions),
          ...(options.plugins || []).map((p) => p(babelOptions)),
        ],
        presets: options.presets || [],
        sourceMaps: true,
      });
      return { code: transformedCode, map };
    },
  };
};

export default createPlugin;
