import { cn } from "../lib/cn";
import { renderChatMarkdown } from "../lib/markdown";
import type { MessageBubbleProps } from "../types";
import { ToolCallCard } from "./tool-call-card";

export function MessageBubble({
  message,
  className,
  renderMarkdown = true,
  showToolCalls = true,
}: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";
  const toolCalls = !isUser && showToolCalls ? (message.toolCalls ?? []) : [];

  return (
    <div
      className={cn(
        "prc-flex prc-w-full",
        isUser ? "prc-justify-end" : "prc-justify-start",
        className,
      )}
    >
      <div className="prc-flex prc-max-w-[80%] prc-flex-col prc-gap-1.5">
        {toolCalls.length > 0 && (
          <div className="prc-flex prc-flex-col prc-gap-1">
            {toolCalls.map((tc) => (
              <ToolCallCard key={tc.id} toolCall={tc} />
            ))}
          </div>
        )}

        <div
          className={cn(
            "prc-rounded-2xl prc-px-4 prc-py-2.5 prc-text-sm prc-leading-relaxed",
            isUser
              ? "prc-bg-primary prc-text-white"
              : "prc-bg-surface-secondary prc-text-text-primary",
            isError && "prc-border prc-border-red-300 prc-bg-red-50",
          )}
        >
          {renderMarkdown ? (
            <div
              className="prc-prose prc-prose-sm prc-max-w-none"
              dangerouslySetInnerHTML={{
                __html: renderChatMarkdown(message.content),
              }}
            />
          ) : (
            <p className="prc-whitespace-pre-wrap">{message.content}</p>
          )}

          {isStreaming && (
            <span className="prc-inline-block prc-h-4 prc-w-1 prc-animate-pulse prc-bg-current prc-ml-0.5" />
          )}

          {isError && typeof message.metadata?.error === "string" && (
            <p className="prc-mt-1 prc-text-xs prc-text-red-600">{message.metadata.error}</p>
          )}
        </div>
      </div>
    </div>
  );
}
