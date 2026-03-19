import type { MessageBubbleProps } from "../types";
import { cn } from "../lib/cn";

export function MessageBubble({ message, className, renderMarkdown = true }: MessageBubbleProps) {
  const isUser = message.role === "user";
  const isError = message.status === "error";
  const isStreaming = message.status === "streaming";

  return (
    <div
      className={cn(
        "prc-flex prc-w-full",
        isUser ? "prc-justify-end" : "prc-justify-start",
        className,
      )}
    >
      <div
        className={cn(
          "prc-max-w-[80%] prc-rounded-2xl prc-px-4 prc-py-2.5 prc-text-sm prc-leading-relaxed",
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
              __html: renderSimpleMarkdown(message.content),
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
  );
}

/**
 * Minimal markdown renderer for chat messages.
 * Supports: bold, italic, inline code, code blocks, links, line breaks.
 */
function renderSimpleMarkdown(text: string): string {
  if (!text) return "";

  let html = escapeHtml(text);

  // Code blocks (```)
  html = html.replace(
    /```(\w*)\n([\s\S]*?)```/g,
    '<pre class="prc-rounded prc-bg-gray-800 prc-text-gray-100 prc-p-3 prc-my-2 prc-overflow-x-auto prc-text-xs"><code>$2</code></pre>',
  );

  // Inline code (`)
  html = html.replace(
    /`([^`]+)`/g,
    '<code class="prc-rounded prc-bg-gray-100 prc-px-1.5 prc-py-0.5 prc-text-xs prc-font-mono">$1</code>',
  );

  // Bold (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

  // Italic (*text*)
  html = html.replace(/\*(.+?)\*/g, "<em>$1</em>");

  // Links [text](url)
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="prc-text-primary prc-underline">$1</a>',
  );

  // Line breaks
  html = html.replace(/\n/g, "<br />");

  return html;
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (m) => map[m] ?? m);
}
