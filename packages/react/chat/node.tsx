import { useContext, useEffect, useMemo } from "react";
import { useStore } from "zustand";
import type { Chat } from "@reagentai/reagent/chat";

import { useReagentContext } from "../workflow/context.js";
import { ChatStore } from "./state.js";

const AgentNodeRenderer = (
  props: {
    messageId: string;
    ui: Chat.UIRenderData;
    store: ChatStore;
  } & Pick<Chat.Message, "node">
) => {
  "use client";
  if (!props.node) {
    return null;
  }
  const { templatesById, AppContext } = useReagentContext();
  const components = useMemo(() => {
    const template = templatesById[props.node!.type];
    // ignore UI rendering if agent node not found
    if (!template) {
      return {};
    }
    return template.components.reduce(
      (agg, curr) => {
        agg[curr[0]] = curr[1];
        return agg;
      },
      {} as Record<string, () => JSX.Element>
    );
  }, [props.node.type, templatesById]);

  const Component = useMemo(() => {
    return components[props.ui.step];
  }, [props.ui.step, components]);

  if (!Component) {
    return <></>;
  }
  return (
    <Component
      // @ts-expect-error
      data={props.ui.data}
      context={{
        sendOutput(output: any) {
          throw new Error("unsupported");
        },
      }}
      React={{
        useContext,
        useEffect,
      }}
      AppContext={AppContext}
      useAgentNode={() => {
        const { persistentStateByMessageId, setPersistentState: setState } =
          useStore(props.store);
        const state = persistentStateByMessageId[props.messageId];
        return {
          state,
          setState(state: any) {
            if (typeof state == "function") {
              state = state(persistentStateByMessageId[props.messageId]);
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
