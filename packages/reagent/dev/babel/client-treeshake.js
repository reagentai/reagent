import * as t from "@babel/types";

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

const treeshake = {
  CallExpression(path) {
    if (path.scope != this.state.scope || !this.state.isReagentaiAgentModule) {
      return;
    }
    const callee = path.get("callee");
    if (
      t.isIdentifier(callee.node) &&
      !this.state.exportedIdentifiers.has(callee.node.name)
    ) {
      path.traverse({
        Identifier(path) {
          path.__reagentNodeRemoved = Boolean(!path.__reagentSkipTreeshake);
        },
      });
      path.remove();
    } else if (
      t.isMemberExpression(callee) &&
      !this.state.exportedIdentifiers.has(callee.node.object.name)
    ) {
      path.traverse({
        Identifier(path) {
          path.__reagentNodeRemoved = Boolean(!path.__reagentSkipTreeshake);
        },
      });
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
      path.traverse({
        Identifier(path) {
          path.__reagentNodeRemoved = Boolean(!path.__reagentSkipTreeshake);
        },
      });
      path.remove();
    } else {
      path.skip();
    }
  },
  ClassDeclaration(path) {
    if (!this.state.isReagentaiAgentModule) {
      return;
    }
    if (
      // since only imports are treeshook, dont need to check scope?
      // TODO: if scope needs to be checked, find a way to do it accurately
      // path.scope == this.state.scope &&
      !this.state.exportedIdentifiers.has(path.node.id.name)
    ) {
      path.traverse({
        Identifier(path) {
          path.__reagentNodeRemoved = Boolean(!path.__reagentSkipTreeshake);
        },
      });
      path.remove();
    } else {
      path.skip();
    }
  },
};

/**
 * @typedef Options
 * @type {object}
 *
 * @property {boolean} [disable] - glob pattern to include files
 * @property {string[]} [preserveImports] - imports to preserve; i.e. dont treeshake
 */

/**
 *
 * @param {Options} options
 */
function createRemoveDefaultExportPlugin(options) {
  const preserveImports = options.preserveImports || [];
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
              exportedIdentifiers: new Set(),
              isReagentaiAgentModule: false,
            };
            path.traverse(findExportedIdentifiers, state);
            this.state = state;
            path.traverse(treeshake, { state });
          },
          exit(path) {
            if (!this.state.isReagentaiAgentModule) {
              return;
            }
            // remove all unused imports
            // TODO: remove default export
            path.traverse({
              ImportDeclaration(path) {
                const specifiers = path.get("specifiers");
                const filtered = specifiers.filter((specifier) => {
                  // dont filter out if import source needs to be preserved
                  // TODO: handle packages that starts with "@"; i.e. with org name
                  const source = path.node.source.value.split("/");
                  if (preserveImports.includes(source[0])) {
                    return true;
                  }
                  const localName = specifier.node.local.name;
                  const binding = path.scope.getBinding(localName);

                  const allReferencesRemoved = binding.referencePaths.every(
                    (p) => {
                      return p.__reagentNodeRemoved;
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
      },
    };
  };
}

export { createRemoveDefaultExportPlugin };
