import tranformCreateAgentNodeClient from "./client-plugin.js";
import tranformCreateAgentNodeServer from "./server-plugin.js";

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
  const tranformCreateAgentNode = options.ssr
    ? tranformCreateAgentNodeServer
    : tranformCreateAgentNodeClient;
  return ({ types: t }) => {
    return {
      pre() {
        this.state = {};
      },
      visitor: {
        Program(path) {
          if (
            path.node.directives.find((directive) => {
              return directive.value.value == "@reagent-skip-transform";
            })
          ) {
            path.stop();
          }
        },
        ImportDeclaration(path) {
          if (path.node.source.value.startsWith("@reagentai/reagent")) {
            const specifiers = path.get("specifiers");
            const createReagentNodeSpecifier = specifiers.find((specifier) => {
              return (
                // skip default import
                specifier.node.imported &&
                specifier.node.imported.name == "createReagentNode"
              );
            });

            if (createReagentNodeSpecifier) {
              this.state._createReagentNode = {
                local: createReagentNodeSpecifier.get("local"),
              };
            }
          }
        },
        CallExpression(path) {
          if (
            !this.state._createReagentNode ||
            path.node.callee.name !=
              this.state._createReagentNode.local.node.name
          ) {
            return;
          }
          const { node } = path;
          if (
            node.callee.name == this.state._createReagentNode.local.node.name
          ) {
            const callee = path.get("callee");
            // make sure the scope matches
            if (callee.scope != this.state._createReagentNode.local.scope) {
              return;
            }
            if (!options.ssr) {
              path.traverse({
                Identifier(path) {
                  path.__reagentNodeRemoved = true;
                },
              });
              path.traverse(tranformCreateAgentNode, this.state);
              path.replaceWith(
                t.objectExpression(
                  node.arguments[0].properties.filter((prop) => {
                    const preserve =
                      options.ssr ||
                      [
                        "id",
                        "version",
                        "name",
                        "target",
                        "components",
                        "execute",
                      ].includes(prop.key.name);
                    if (!preserve) {
                      path.traverse({
                        Identifier(path) {
                          path.__reagentNodeRemoved = true;
                        },
                      });
                    }
                    return preserve;
                  })
                )
              );
            } else {
              const state = {
                hasUI: false,
              };
              node.arguments[0].properties.forEach((prop) => {
                if (prop.key.name == "execute") {
                  path.traverse(tranformCreateAgentNode, state);
                }
              });
              if (state.hasUI) {
                node.arguments[0].properties.push(
                  t.objectProperty(
                    t.identifier("hasUI"),
                    t.booleanLiteral(state.hasUI)
                  )
                );
              }
            }
          }
        },
      },
    };
  };
}

export default createPlugin;
