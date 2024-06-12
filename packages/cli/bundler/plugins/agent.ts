import { transformSync, DEFAULT_EXTENSIONS } from "@babel/core";
// @ts-expect-error
import picomatch from "picomatch";
// @ts-expect-error
import babelSyntaxJsx from "@babel/plugin-syntax-jsx";

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
  const shouldExclude = picomatch(options.exclude || [], {
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
          createRemoveExportsPlugin({
            preserveExports: ["nodes"],
          }),
          babelSyntaxJsx,
        ],
        sourceMaps: true,
      })!;
      return { code: transformedCode, map };
    },
  };
};

const createFindExportedIdentifiers = () => {
  const visitor = {
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
  };
  return {
    ExportNamedDeclaration(path: any, state: any) {
      path.traverse(visitor, state);
    },
  };
};

function createRemoveExportsPlugin(options: {
  disable?: boolean;
  preserveExports: string[];
}) {
  const findExportedIdentifiers = createFindExportedIdentifiers();
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
            // @ts-expect-error
            this.removedIdentifiers = [];
            path.traverse(findExportedIdentifiers, state);
            // @ts-expect-error
            this.state = state;
            if (!state.isReagentaiAgentModule) {
              path.stop();
            }
          },
          exit(path: any) {
            const self = this;
            // remove all unused imports
            // TODO: remove default export
            path.traverse({
              ImportDeclaration(path: any) {
                const specifiers = path.get("specifiers");
                const filtered = specifiers.filter((specifier: any) => {
                  const localName = specifier.node.local.name;
                  const binding = path.scope.getBinding(localName);

                  const allReferencesRemoved = binding.referencePaths.every(
                    (p: any) => {
                      // @ts-expect-error
                      return self.removedIdentifiers.find(
                        (ri: any) => ri === p
                      );
                    }
                  );
                  return !allReferencesRemoved;
                });
                if (filtered.length == 0) {
                  path.remove();
                } else {
                  path.node.specifiers = filtered.map((p: any) => p.node);
                }
              },
            });
          },
        },
        ExportDefaultDeclaration(path: any) {
          path.skip();
          path.replaceWith(
            t.exportDefaultDeclaration(
              t.stringLiteral("__removed_by_reagent__")
            )
          );
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
            path.traverse(
              {
                Identifier(path: any) {
                  this.removedIdentifiers.push(path);
                },
              },
              {
                // @ts-expect-error
                removedIdentifiers: this.removedIdentifiers,
              }
            );
            path.remove();
          } else if (
            t.isMemberExpression(callee) &&
            // @ts-expect-error
            !this.state.exportedIdentifiers.includes(callee.node.object.name)
          ) {
            path.traverse(
              {
                Identifier(path: any) {
                  this.removedIdentifiers.push(path);
                },
              },
              {
                // @ts-expect-error
                removedIdentifiers: this.removedIdentifiers,
              }
            );
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
            path.traverse(
              {
                Identifier(path: any) {
                  this.removedIdentifiers.push(path);
                },
              },
              {
                // @ts-expect-error
                removedIdentifiers: this.removedIdentifiers,
              }
            );
            path.remove();
          } else {
            path.skip();
          }
        },
      },
    } as any;
  };
}

export { createRemoveExportsPlugin };
export default createPlugin;
