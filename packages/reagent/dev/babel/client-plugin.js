import * as t from "@babel/types";

const tranformCreateAgentNode = {
  ObjectExpression: {
    enter(_path, state) {
      this.state = {
        _createReagentNode: state._createReagentNode,
        // will be marked as true if target is "client"
        targetClient: false,
        components: {},
        renderCalls: [],
      };
    },
    exit(path) {
      if (path.scope != this.state._createReagentNode.local.scope) {
        return;
      }
      if (this.state.renderCalls.length > 0) {
        path.node.properties.push(
          t.objectProperty(
            t.identifier("components"),
            t.arrayExpression(this.state.renderCalls)
          )
        );
      }
    },
  },
  ObjectProperty(path) {
    const { key, value } = path.node;
    if (key.name == "target" && value.value == "client") {
      this.state.targetClient = true;
    }
    if (
      ![
        "id",
        "version",
        "name",
        "target",
        "components",
        "client",
        "execute",
      ].includes(path.node.key.name)
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
  ObjectMethod(path) {
    if (path.node.key.name != "execute") {
      path.traverse({
        Identifier(path) {
          path.__reagentNodeRemoved = Boolean(!path.__reagentSkipTreeshake);
        },
      });
      path.remove();
      return;
    }
    const context = path.get("params")[0];

    this.state.method = path.node;
    this.state.contextName = context.node.name;
    this.state.context = context;

    path.traverse(transformCreateAgentNodeExecuteMethod, this.state);

    if (!this.state.targetClient) {
      path.traverse({
        Identifier(path) {
          if (!path.__reagentSkipTreeshake) {
            path.__reagentNodeRemoved = Boolean(!path.__reagentSkipTreeshake);
          }
        },
      });
      path.remove();
    } else {
      path.skip();
    }
  },
};

const transformCreateAgentNodeExecuteMethod = {
  BlockStatement: {
    enter(_path) {},
    exit(path) {
      if (path.parent !== this.method) {
        return;
      }
      // if the target for this node isn't "client", mark all identifiers
      // as removed since "execute" method will be removed for client code.
      // so, mark the nodes that replaced old nodes as not-removed
      // TODO: there must be a better solution
      if (!this.targetClient) {
        path.traverse({
          Identifier(path) {
            path.__reagentNodeRemoved = undefined;
          },
        });
      }
    },
  },
  CallExpression(path) {
    const callee = path.get("callee");
    const isContextRender =
      t.isMemberExpression(callee.node) &&
      t.isIdentifier(callee.node.object, { name: this.contextName }) &&
      (t.isIdentifier(callee.node.property, { name: "render" }) ||
        t.isIdentifier(callee.node.property, { name: "prompt" }));

    if (!isContextRender) {
      return;
    }

    // dont treeshake the identifiers inside context.render/prompt
    path.traverse({
      Identifier(path) {
        path.__reagentSkipTreeshake = true;
      },
    });
    this.renderCalls.push(
      t.arrayExpression([
        // add render id as the first argument
        path.node.arguments[0],
        path.node.arguments[1],
      ])
    );
  },
};

export default tranformCreateAgentNode;
