import React from "react";
import { useNavigate, useParams } from "@remix-run/react";
import ReagentDemo from "@reagentai/react/demo";

const Chat = () => {
  const navigate = useNavigate();
  const params = useParams();
  return (
    <ReagentDemo
      activeAgentId={params.agent!}
      setActiveAgentId={(id) => {
        navigate(`/chat/${id}`);
      }}
    />
  );
};

export default Chat;
