import { createContext, useContext, useMemo } from "react";
import type { AgentNode } from "@portal/cortex/agent";

type Context = {
  nodesByTypeId: Record<string, AgentNode<any, any, any>>;
};
const AgentContext = createContext<Context>({
  nodesByTypeId: {},
});
const useAgentContext = () => useContext(AgentContext)!;

const AgentContextProvider = (props: {
  nodes: AgentNode<any, any, any>[];
  children: any;
}) => {
  const nodesByTypeId = useMemo(() => {
    return props.nodes.reduce((agg, curr) => {
      // @ts-expect-error
      agg[curr.id] = curr;
      return agg;
    }, {});
  }, [props.nodes]);

  return (
    <AgentContext.Provider value={{ nodesByTypeId }}>
      {props.children}
    </AgentContext.Provider>
  );
};

export { useAgentContext, AgentContextProvider };
