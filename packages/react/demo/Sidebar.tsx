type SidebarProps = {
  agents: { id: string; name: string }[];
  activeAgentId: string;
  setActiveAgentId: (id: string) => void;
};

const Sidebar = (props: SidebarProps) => {
  return (
    <div className="">
      <div className="py-4 text-lg font-medium text-center text-gray-700">
        Agents
      </div>
      <div className="text-sm">
        {props.agents.map((agent) => {
          return (
            <div
              key={agent.id}
              className="px-4 py-2 cursor-pointer hover:bg-indigo-50/50 data-[active=true]:font-medium data-[active=true]:bg-indigo-50 data-[active=true]:text-indigo-500"
              data-active={props.activeAgentId == agent.id}
              onClick={() => props.setActiveAgentId(agent.id)}
            >
              {agent.name}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Sidebar;
export type { SidebarProps };
