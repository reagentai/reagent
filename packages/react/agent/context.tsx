import { createContext, useContext, useMemo } from "react";
import type { AgentNode } from "@reagentai/reagent/agent";

type Context = {
  nodesByTypeId: Record<string, AgentNode<any, any, any>>;
};
const AgentContext = createContext<Context>({
  nodesByTypeId: {},
});
const useReagentContext = () => useContext(AgentContext)!;

const ReagentContextProvider = (props: {
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

export { useReagentContext, ReagentContextProvider };
