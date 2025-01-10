import * as t from "@babel/types";

const tranformCreateAgentNode = {
  ObjectMethod(path, state) {
    if (path.node.key.name != "execute") {
      path.skip();
    }
    const context = path.get("params")[0];
    const runState = {
      method: path.node,
      contextName: context.node.name,
      context,
      renderCallCount: 0,
      hasUI: false,
    };
    path.traverse(transformCreateAgentNodeRunMethod, runState);
    state.hasUI = runState.hasUI;
  },
};

const transformCreateAgentNodeRunMethod = {
  CallExpression(path, state) {
    const callee = path.get("callee");
    const isContextRender =
      t.isMemberExpression(callee.node) &&
      t.isIdentifier(callee.node.object, { name: this.contextName }) &&
      (t.isIdentifier(callee.node.property, { name: "render" }) ||
        t.isIdentifier(callee.node.property, { name: "prompt" }));

    if (!isContextRender) {
      return;
    }
    const [_, __, ...callArgs] = path.node.arguments;
    const args = [path.node.arguments[0], t.nullLiteral()];
    if (callArgs.length > 0) {
      args.push(...callArgs);
    }
    path.node.arguments = args;
    state.hasUI = true;
  },
};

export default tranformCreateAgentNode;
