"use client";
import React from "react";
import { useRouter } from "next/navigation";
import ReagentDemo from "@useportal/reagent-react/demo";

const Chat = ({ params }: any) => {
  const router = useRouter();
  return (
    <ReagentDemo
      activeAgentId={params.agent!}
      setActiveAgentId={(id) => {
        router.push(`/chat/${id}`);
      }}
    />
  );
};

export default Chat;
