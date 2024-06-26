import { Chatbox } from "./ChatBox.js";
import { ChatThread } from "./ChatThread.js";
import { ChatStore } from "./state.js";

const ReagentChat = (props: { store: ChatStore }) => {
  const sendNewMessage = props.store(
    (s) => (input: any) =>
      s.invoke({
        nodeId: "input",
        input,
      })
  );
  const sendNewMessageMutation = {
    mutate(input: any) {
      sendNewMessage(input);
    },
  };

  return (
    <div className="chat flex relative flex-1 h-full overflow-hidden">
      <div className="relative flex-1 h-full min-w-[300px] overflow-hidden">
        <div className="h-full text-xs">
          <ChatThread store={props.store} />
        </div>
        <div className="chatbox-container absolute bottom-0 w-full px-4 flex justify-center pointer-events-none">
          <div className="flex-1 min-w-[200px] max-w-[750px] rounded-lg pointer-events-auto backdrop-blur-xl space-y-1">
            <div className="mb-4 bg-gray-400/10 rounded">
              <Chatbox
                isChatLocked={false}
                sendNewMessage={(input) => sendNewMessageMutation.mutate(input)}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export { ReagentChat };
