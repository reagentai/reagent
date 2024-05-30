import { useNavigate } from "@remix-run/react";
import ReagentDemo from "@reagentai/reagent-react/demo";

const Home = () => {
  const navigate = useNavigate();
  return (
    <ReagentDemo
      activeAgentId={"default"}
      setActiveAgentId={(id) => {
        navigate(`/chat/${id}`);
      }}
    />
  );
};

export default Home;
