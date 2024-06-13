const createFindExportedIdentifiers = () => {
  const visitor = {
    ClassBody(path) {
      path.skip();
    },
    Identifier(path, state) {
      if (path.node.name == "__reagentai_exports__") {
        state.isReagentaiAgentModule = true;
      }
      state.exportedIdentifiers.add(path.node.name);
    },
  };
  return {
    ExportNamedDeclaration(path, state) {
      path.traverse(visitor, state);
    },
  };
};

/**
 * @typedef Options
 * @type {object}
 *
 * @property {boolean} [disable] - glob pattern to include files
 * @property {string[]} preserveExports - glob pattern to exclude files
 */

/**
 *
 * @param {Options} options
 */
function createRemoveExportsPlugin(options) {
  const findExportedIdentifiers = createFindExportedIdentifiers();
  return ({ types: t }) => {
    return {
      visitor: {
        Program: {
          enter(path) {
            if (options.disable) {
              return path.stop();
            }
            const state = {
              scope: path.scope,
              preserveExports: [
                ...options.preserveExports,
                "__reagentai_exports__",
              ],
              exportedIdentifiers: new Set(),
              isReagentaiAgentModule: false,
            };
            this.removedIdentifiers = [];
            path.traverse(findExportedIdentifiers, state);
            this.state = state;
          },
          exit(path) {
            const self = this;
            // remove all unused imports
            // TODO: remove default export
            path.traverse({
              ImportDeclaration(path) {
                const specifiers = path.get("specifiers");
                const filtered = specifiers.filter((specifier) => {
                  const localName = specifier.node.local.name;
                  const binding = path.scope.getBinding(localName);

                  const allReferencesRemoved = binding.referencePaths.every(
                    (p) => {
                      return self.removedIdentifiers.find((ri) => ri === p);
                    }
                  );
                  return !allReferencesRemoved;
                });
                if (filtered.length == 0) {
                  path.remove();
                } else {
                  path.node.specifiers = filtered.map((p) => p.node);
                }
              },
            });
          },
        },
        ExportDefaultDeclaration(path) {
          if (!this.state.isReagentaiAgentModule) {
            return;
          }
          path.skip();
          path.replaceWith(
            t.exportDefaultDeclaration(
              t.stringLiteral("__removed_by_reagent__")
            )
          );
        },
        CallExpression(path) {
          if (
            path.scope != this.state.scope ||
            !this.state.isReagentaiAgentModule
          ) {
            return;
          }
          const callee = path.get("callee");
          if (
            t.isIdentifier(callee.node) &&
            !this.state.exportedIdentifiers.has(callee.node.name)
          ) {
            path.traverse(
              {
                Identifier(path) {
                  this.removedIdentifiers.push(path);
                },
              },
              {
                removedIdentifiers: this.removedIdentifiers,
              }
            );
            path.remove();
          } else if (
            t.isMemberExpression(callee) &&
            !this.state.exportedIdentifiers.has(callee.node.object.name)
          ) {
            path.traverse(
              {
                Identifier(path) {
                  this.removedIdentifiers.push(path);
                },
              },
              {
                removedIdentifiers: this.removedIdentifiers,
              }
            );
            path.remove();
          }
        },
        VariableDeclarator(path) {
          if (!this.state.isReagentaiAgentModule) {
            return;
          }
          if (
            path.scope == this.state.scope &&
            !this.state.exportedIdentifiers.has(path.node.id.name)
          ) {
            path.traverse(
              {
                Identifier(path) {
                  this.removedIdentifiers.push(path);
                },
              },
              {
                removedIdentifiers: this.removedIdentifiers,
              }
            );
            path.remove();
          } else {
            path.skip();
          }
        },
      },
    };
  };
}

export { createRemoveExportsPlugin };
