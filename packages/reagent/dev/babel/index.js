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
        ImportDeclaration(path, state) {
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
              state._createReagentNode = {
                local: createReagentNodeSpecifier.get("local"),
              };
            }
          }
        },
        CallExpression(path, state) {
          if (!state._createReagentNode) {
            return;
          }
          const { node } = path;
          if (node.callee.name == state._createReagentNode.local.node.name) {
            const callee = path.get("callee");
            // make sure the scope matches
            if (callee.scope != state._createReagentNode.local.scope) {
              return;
            }
            path.skip();
            if (!options.ssr) {
              path.traverse({
                Identifier(path) {
                  path.__reagentNodeRemoved = true;
                },
              });
              node.arguments[0].properties.forEach((prop) => {
                if (prop.key.name == "execute") {
                  path.traverse(tranformCreateAgentNode, state);
                }
              });
              path.replaceWith(
                t.objectExpression(
                  node.arguments[0].properties.filter((prop) => {
                    return (
                      options.ssr ||
                      ["id", "version", "name", "execute"].includes(
                        prop.key.name
                      )
                    );
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
