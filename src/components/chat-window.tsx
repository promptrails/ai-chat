import type { ChatWindowProps } from "../types";
import { useChat } from "../core/use-chat";
import { useApproval } from "../core/use-approval";
import { cn } from "../lib/cn";
import { AgentSteps } from "./agent-steps";
import { ApprovalCard } from "./approval-card";
import { ChatHeader } from "./chat-header";
import { MessageBubble } from "./message-bubble";
import { MessageInput } from "./message-input";
import { ScrollAnchor } from "./scroll-anchor";
import { TypingIndicator } from "./typing-indicator";

export function ChatWindow({
  provider,
  sessionId,
  initialMessages,
  title,
  placeholder,
  className,
  showAgentSteps = false,
  showApprovals = false,
  onError,
}: ChatWindowProps & { onClose?: () => void }) {
  const chat = useChat({
    provider,
    sessionId,
    initialMessages,
    onError,
  });

  const approval = useApproval({
    provider,
  });

  return (
    <div
      className={cn(
        "prc-flex prc-h-full prc-flex-col prc-overflow-hidden prc-rounded-2xl prc-border prc-border-gray-200 prc-bg-surface",
        className,
      )}
    >
      <ChatHeader title={title} />

      {/* Messages */}
      <div className="prc-flex-1 prc-overflow-y-auto prc-p-4 prc-space-y-3">
        {chat.messages.length === 0 && (
          <div className="prc-flex prc-h-full prc-items-center prc-justify-center">
            <p className="prc-text-sm prc-text-text-secondary">Start a conversation</p>
          </div>
        )}

        {chat.messages.map((message) => (
          <MessageBubble key={message.id} message={message} />
        ))}

        {showAgentSteps && <AgentSteps steps={[]} />}

        {showApprovals &&
          approval.pendingApprovals.map((req) => (
            <ApprovalCard
              key={req.id}
              request={req}
              onApprove={approval.approve}
              onReject={approval.reject}
              disabled={approval.isDeciding}
            />
          ))}

        {chat.isLoading && <TypingIndicator />}

        <ScrollAnchor trackVisibility />
      </div>

      {/* Input */}
      <MessageInput
        value={chat.input}
        onChange={chat.setInput}
        onSubmit={chat.handleSubmit}
        placeholder={placeholder}
        disabled={chat.isLoading}
      />
    </div>
  );
}
