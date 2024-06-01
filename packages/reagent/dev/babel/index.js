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
            const createAgentNodeSpecifier = specifiers.find((specifier) => {
              return (
                // skip default import
                specifier.node.imported &&
                specifier.node.imported.name == "createAgentNode"
              );
            });

            if (createAgentNodeSpecifier && createAgentNodeSpecifier) {
              state._createAgentNode = {
                local: createAgentNodeSpecifier.get("local"),
              };
            }
          }
        },
        ExpressionStatement(path, state) {
          if (!state._createAgentNode) {
            path.skip();
            return;
          }
        },
        CallExpression(path, state) {
          if (!state._createAgentNode) {
            path.skip();
            return;
          }
          const { node } = path;
          if (node.callee.name == state._createAgentNode.local.node.name) {
            const callee = path.get("callee");
            // make sure the scope matches
            if (callee.scope != state._createAgentNode.local.scope) {
              return;
            }
            path.skip();
            if (!options.ssr) {
              path.replaceWith(
                t.objectExpression(
                  node.arguments[0].properties.filter((prop) => {
                    if (prop.key.name == "execute") {
                      path.traverse(tranformCreateAgentNode);
                    }
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
              node.arguments[0].properties.forEach((prop) => {
                if (prop.key.name == "execute") {
                  path.traverse(tranformCreateAgentNode);
                }
              });
            }
          }
        },
      },
    };
  };
}

export default createPlugin;
