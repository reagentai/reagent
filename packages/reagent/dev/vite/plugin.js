import { transformSync, DEFAULT_EXTENSIONS } from "@babel/core";
import picomatch from "picomatch";

import createBabelPlugin from "../babel/index.js";
import { createRemoveDefaultExportPlugin } from "../babel/client-treeshake.js";

function cleanUrl(url) {
  const queryRE = /\?.*$/s;
  const hashRE = /#.*$/s;
  return url.replace(hashRE, "").replace(queryRE, "");
}

const filterRegex = new RegExp(
  `\\.(${[...DEFAULT_EXTENSIONS, "tsx", "ts"].join("|").replace(/\./g, "")})$`
);

/**
 * @typedef Options
 * @type {object}
 *
 * @property {boolean} [ssr] - set this to true to transpile files for frontend
 * @property {string[]} [include] - glob pattern to include files
 * @property {string[]} [exclude] - glob pattern to exclude files; include takes precedence
 * @property {string[]} [preserveImports] - imports to preserve; i.e. dont treeshake
 * @property {any[]} [presets] - babel presets
 * @property {any[]} [plugins] - babel plugins
 */

/**
 *
 * @param {Options} options
 * @returns
 */
const createPlugin = (options = {}) => {
  const shouldInclude = picomatch(options.include || [], {
    dot: true,
  });
  const shouldExclude = picomatch(options.exclude || [], {
    dot: true,
  });
  return {
    name: "vite-plugin-reagent",
    transform(code, id, transformOptions) {
      if (!transformOptions && options.ssr == undefined) {
        throw new Error(
          `expected valid "options" argument in vite "transform" method`
        );
      }
      const filepath = cleanUrl(id);
      if (
        !filterRegex.test(filepath) ||
        (!shouldInclude(filepath) && shouldExclude(filepath))
      ) {
        return;
      }

      const ssr = options.ssr || transformOptions?.ssr;
      const babelOptions = {
        ssr,
      };

      const plugins = [
        createBabelPlugin(babelOptions),
        ...(options.plugins || []),
      ];
      if (!ssr) {
        plugins.push(
          createRemoveDefaultExportPlugin({
            preserveImports: options.preserveImports,
          })
        );
      }
      const { code: transformedCode, map } = transformSync(code, {
        configFile: false,
        babelrc: false,
        filename: id,
        sourceFileName: filepath,
        plugins,
        presets: options.presets || [],
        sourceMaps: true,
      });
      return { code: transformedCode, map };
    },
  };
};

export default createPlugin;
