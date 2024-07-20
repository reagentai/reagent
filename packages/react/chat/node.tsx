import { useMemo } from "react";
import type { Chat } from "@reagentai/reagent/chat";

import { useReagentContext } from "../workflow/context.js";
import { ChatStore } from "./state.js";

const AgentNodeRenderer = (
  props: {
    messageId: string;
    render: Chat.UIRenderData;
    store: ChatStore;
  } & Pick<Chat.Message, "node">
) => {
  "use client";
  if (!props.node) {
    return null;
  }
  const { nodesByTypeId } = useReagentContext();
  const components = useMemo(() => {
    const node = nodesByTypeId[props.node!.type];
    // ignore UI rendering if agent node not found
    if (!node) {
      return [];
    }
    // @ts-expect-error
    return [...node.execute()].reduce(
      (agg, curr) => {
        agg[curr[0]] = curr[1];
        return agg;
      },
      {} as Record<string, () => JSX.Element>
    );
  }, [props.node.type, nodesByTypeId]);

  const Component = useMemo(() => {
    return components[props.render.step];
  }, [props.render.step, components]);

  if (!Component) {
    return <></>;
  }
  return (
    <Component
      data={props.render.data}
      useAgentNode={() => {
        const state = props.store(
          (s) => s.persistentStateByMessageId[props.messageId]
        );
        const setState = props.store((s) => s.setPersistentState);
        return {
          state,
          setState(state: any) {
            if (typeof state == "function") {
              state = state(
                props.store(
                  (s) => s.persistentStateByMessageId[props.messageId]
                )
              );
            }
            setState({
              messageId: props.messageId,
              state,
            });
          },
        };
      }}
    />
  );
};

export { AgentNodeRenderer };
