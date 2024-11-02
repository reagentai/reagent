import { createContext, useContext, useMemo } from "react";
import type {
  BaseReagentNodeOptions,
  WorkflowNode,
} from "@reagentai/reagent/workflow";

type Context = {
  templatesById: Record<
    string,
    BaseReagentNodeOptions<any, any, any> & { components: [] }
  >;
};
const AgentContext = createContext<Context>({
  templatesById: {},
});
const useReagentContext = () => useContext(AgentContext)!;

const ReagentContextProvider = (props: {
  templates: WorkflowNode<any, any, any>[];
  children: any;
}) => {
  const templatesById = useMemo(() => {
    return props.templates.reduce((agg, curr) => {
      // @ts-expect-error
      agg[curr.id] = curr;
      return agg;
    }, {});
  }, [props.templates]);

  return (
    <AgentContext.Provider value={{ templatesById }}>
      {props.children}
    </AgentContext.Provider>
  );
};

export { useReagentContext, ReagentContextProvider };
