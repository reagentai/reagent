import { Chatbox } from "./ChatBox";
import { ChatThread } from "./ChatThread";
import { ChatStore } from "./state";

const AIChat = (props: { store: ChatStore }) => {
  const messages = props.store((s) => s.messages);
  const sortedMessageIds = props.store((s) => s.sortedMessageIds);
  const sendNewMessage = props.store((s) => s.sendNewMessage);
  const sendNewMessageMutation = {
    mutate(input: any) {
      sendNewMessage(input);
    },
  };

  return (
    <div className="chat flex relative flex-1 h-full overflow-hidden">
      <div className="relative flex-1 h-full min-w-[300px] overflow-hidden">
        <div className="h-full text-xs">
          <ChatThread messages={messages} sortedMessageIds={sortedMessageIds} />
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

export { AIChat };
