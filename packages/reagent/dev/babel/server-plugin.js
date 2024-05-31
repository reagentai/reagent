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
  CallExpression(path) {
    const callee = path.get("callee");
    const isContextRender =
      t.isMemberExpression(callee.node) &&
      t.isIdentifier(callee.node.object, { name: this.contextName }) &&
      t.isIdentifier(callee.node.property, { name: "render" });

    if (!isContextRender) {
      return;
    }
    const [_, ...callArgs] = path.node.arguments;
    const args = [
      // TODO: maybe use content hash of the render function as
      // render id instead of counter to guarantee component + state
      // consistency
      t.stringLiteral(`render-${this.renderCallCount++}`),
    ];
    if (callArgs.length > 0) {
      args.push(...callArgs);
    }
    path.node.arguments = args;
  },
};

export default tranformCreateAgentNode;
