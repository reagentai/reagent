import { transformSync, DEFAULT_EXTENSIONS } from "@babel/core";
// @ts-expect-error
import picomatch from "picomatch";

function cleanUrl(url: string) {
  const queryRE = /\?.*$/s;
  const hashRE = /#.*$/s;
  return url.replace(hashRE, "").replace(queryRE, "");
}

const filterRegex = new RegExp(
  `\\.(${[...DEFAULT_EXTENSIONS, "tsx", "ts"].join("|").replace(/\./g, "")})$`
);

type Options = {
  // glob pattern to include files
  include?: string[];
  // glob pattern to exclude files
  exclude?: string[];
};
const createPlugin = (options: Options = {}) => {
  const shouldInclude = picomatch(options.include || [], {
    dot: true,
  });
  const shouldExclude = picomatch(options.exclude || ["**/node_modules/**"], {
    dot: true,
  });
  return {
    name: "vite-plugin-reagent-agent-treeshake",
    transform(code: string, id: string, transformOptions: any) {
      if (!transformOptions) {
        throw new Error(
          `expected valid "options" argument in vite "transform" method`
        );
      }
      const filepath = cleanUrl(id);
      // no need to transform for server module
      if (
        transformOptions.ssr ||
        !filterRegex.test(filepath) ||
        (!shouldInclude(filepath) && shouldExclude(filepath))
      ) {
        return;
      }
      const { code: transformedCode, map } = transformSync(code, {
        configFile: false,
        babelrc: false,
        filename: id,
        sourceFileName: filepath,
        plugins: [
          createBabelPlugin({
            preserveExports: ["nodes"],
          }),
        ],
        sourceMaps: true,
      })!;
      return { code: transformedCode, map };
    },
  };
};

const findExportedIdentifiers = {
  ExportNamedDeclaration(path: any, state: any) {
    path.traverse(
      {
        VariableDeclarator(path: any, state: any) {
          if (!state.preserveExports.includes(path.node.id.name)) {
            path.skip();
          }
        },
        Identifier(path: any, state: any) {
          if (path.node.name == "__reagentai_exports__") {
            state.isReagentaiAgentModule = true;
          }
          state.exportedIdentifiers.push(path.node.name);
        },
      },
      state
    );
  },
};

function createBabelPlugin(options: {
  disable?: boolean;
  preserveExports: string[];
}) {
  return ({ types: t }: any) => {
    return {
      visitor: {
        Program: {
          enter(path: any) {
            if (options.disable) {
              return path.stop();
            }
            const state = {
              scope: path.scope,
              preserveExports: [
                ...options.preserveExports,
                "__reagentai_exports__",
              ],
              exportedIdentifiers: [],
              isReagentaiAgentModule: false,
            };
            path.traverse(findExportedIdentifiers, state);
            // @ts-expect-error
            this.state = state;
            if (!state.isReagentaiAgentModule) {
              path.stop();
            }
          },
          exit(path: any) {},
        },
        ImportDeclaration(path: any) {
          const specifiers = path.get("specifiers");
          const filtered = specifiers.filter((s: any) => {
            // @ts-expect-error
            return this.state.exportedIdentifiers.includes(s.node.local.name);
          });
          if (filtered.length == 0) {
            path.remove();
          } else {
            path.node.specifiers = filtered.map((p: any) => p.node);
          }
        },
        ExportDefaultDeclaration(path: any) {
          path.remove();
        },
        CallExpression(path: any) {
          if (
            // @ts-expect-error
            path.scope != this.state.scope
          ) {
            return;
          }
          const callee = path.get("callee");
          if (
            t.isIdentifier(callee.node) &&
            // @ts-expect-error
            !this.state.exportedIdentifiers.includes(callee.node.name)
          ) {
            path.remove();
          } else if (
            t.isMemberExpression(callee) &&
            // @ts-expect-error
            !this.state.exportedIdentifiers.includes(callee.node.object.name)
          ) {
            path.remove();
          }
        },
        VariableDeclarator(path: any) {
          if (
            // @ts-expect-error
            path.scope == this.state.scope &&
            // @ts-expect-error
            !this.state.exportedIdentifiers.includes(path.node.id.name)
          ) {
            path.remove();
          } else {
            path.skip();
          }
        },
      },
    } as any;
  };
}

export { createBabelPlugin };
export default createPlugin;
