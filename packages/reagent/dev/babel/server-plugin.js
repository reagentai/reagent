import * as t from "@babel/types";

const tranformCreateAgentNode = {
  ObjectMethod(path) {
    if (path.node.key.name != "execute") {
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
    // only check for the top level block statements of execute methods
    path.skip();
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

      // skip the expression if node is undefined
      if (!expression.node) {
        return expr;
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
            // TODO: maybe use content hash of the render function as
            // render id instead of counter to guarantee component + state
            // consistency
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

export default tranformCreateAgentNode;
