import * as t from "@babel/types";

const tranformCreateAgentNode = {
  ObjectMethod(path) {
    if (path.node.key.name != "execute") {
      return;
    }
    // make sure run is non-async generator
    path.node.generator = true;
    path.node.async = false;
    const context = path.get("params")[0];
    path.traverse(transformCreateAgentNodeExecuteMethod, {
      method: path.node,
      contextName: context.node.name,
      context,
      renderCalls: [],
      renderCallCount: 0,
    });
    path.skip();
  },
};

const transformCreateAgentNodeExecuteMethod = {
  BlockStatement: {
    enter(_path) {},
    exit(path) {
      if (path.parent !== this.method) {
        return;
      }
      path.skip();
      path.replaceWith(
        t.blockStatement(
          this.renderCalls.map((renderCall) => {
            return t.expressionStatement(renderCall);
          })
        )
      );
      // all identifier nodes in createReagentNode is already marked
      // as removed since it's being replaced with a new node.
      // so, mark the nodes that replaced old nodes as not-removed
      // TODO: there must be a better solution
      path.traverse({
        Identifier(path) {
          path.__reagentNodeRemoved = undefined;
        },
      });
    },
  },
  CallExpression(path) {
    const callee = path.get("callee");
    const isContextRender =
      t.isMemberExpression(callee.node) &&
      t.isIdentifier(callee.node.object, { name: this.contextName }) &&
      t.isIdentifier(callee.node.property, { name: "render" });

    if (!isContextRender) {
      return;
    }
    this.renderCalls.push(
      t.yieldExpression(
        t.arrayExpression([
          // add render id as the first argument
          t.stringLiteral(`render-${this.renderCallCount++}`),
          path.node.arguments[0],
        ])
      )
    );
  },
};

export default tranformCreateAgentNode;
