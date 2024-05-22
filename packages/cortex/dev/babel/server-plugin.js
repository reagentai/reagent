import * as t from "@babel/types";

const tranformCreateAgentNode = {
  ObjectMethod(path) {
    if (path.node.key.name != "run") {
      path.skip();
    }
    const context = path.get("params")[0];
    path.traverse(transformCreateAgentNodeRunMethod, {
      method: path.node,
      contextName: context.node.name,
      context,
      renderCallCount: 0,
    });
  },
};

const transformCreateAgentNodeRunMethod = {
  BlockStatement(path) {
    if (path.parent !== this.method) {
      return;
    }
    const body = path.get("body");
    path.node.body = path.node.body.map((expr, index) => {
      let expression = body[index].get("expression");
      const declarations = body[index].get("declarations");
      // Since only `context.render` or `const xyz = context.render`
      // needs to be modified, return other expressions early
      if (!expression.node && declarations.length == 0) {
        return expr;
      }
      // if it's a var declaration, check the init expression
      if (declarations.length > 0 && !expression.node) {
        expression = declarations[0].get("init");
      }

      const callee = expression.get("callee");
      const isContextRender =
        t.isMemberExpression(callee.node) &&
        t.isIdentifier(callee.node.object, { name: this.contextName }) &&
        t.isIdentifier(callee.node.property, { name: "render" });
      if (isContextRender) {
        const context = callee.get("object");
        if (this.context.scope == context.scope) {
          expression.node.arguments = [
            t.stringLiteral(`render-${this.renderCallCount++}`),
            ...([expression.node.arguments[1]] || []),
          ];
        }
        return expr;
      }
      return expr;
    });
  },
};

function createPlugin() {
  return ({ types: t }) => {
    return {
      visitor: {
        CallExpression(path) {
          const { node } = path;
          // TODO: make sure createAgentNode is the one from "@portal/cortex/agent"
          if (path.node.callee.name == "createAgentNode") {
            node.arguments[0].properties.forEach((prop, index) => {
              if (prop.key.name == "run") {
                path.traverse(tranformCreateAgentNode, { run: prop });
              }
            });
          }
        },
      },
    };
  };
}

export default createPlugin;
