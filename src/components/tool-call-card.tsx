import { useState } from "react";
import type { ToolCall } from "../types";
import { cn } from "../lib/cn";

export interface ToolCallCardProps {
  toolCall: ToolCall;
  className?: string;
}

export function ToolCallCard({ toolCall, className }: ToolCallCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const hasResult = typeof toolCall.result === "string" && toolCall.result.length > 0;

  return (
    <div
      className={cn("prc-rounded-md prc-border prc-bg-surface-secondary/50 prc-text-xs", className)}
    >
      <button
        type="button"
        onClick={() => hasResult && setIsOpen((v) => !v)}
        disabled={!hasResult}
        className={cn(
          "prc-flex prc-w-full prc-items-center prc-gap-2 prc-px-2.5 prc-py-1.5 prc-text-left",
          hasResult && "hover:prc-bg-surface-secondary",
        )}
      >
        <StatusIcon status={toolCall.status} />
        <span className="prc-flex-1 prc-truncate prc-font-mono prc-text-[11px]">
          {toolCall.name || "tool"}
        </span>
        {hasResult && (
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn(
              "prc-h-3.5 prc-w-3.5 prc-text-text-secondary prc-transition-transform",
              isOpen && "prc-rotate-90",
            )}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clipRule="evenodd"
            />
          </svg>
        )}
      </button>

      {isOpen && hasResult && (
        <pre className="prc-overflow-x-auto prc-border-t prc-bg-gray-50 prc-px-2.5 prc-py-1.5 prc-text-[10px] prc-text-text-secondary">
          {toolCall.result}
        </pre>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: ToolCall["status"] }) {
  if (status === "running") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className="prc-h-3.5 prc-w-3.5 prc-animate-spin prc-text-text-secondary"
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
    );
  }
  if (status === "error") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="prc-h-3.5 prc-w-3.5 prc-text-red-500"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm-3.28-3.28a.75.75 0 0 1 0-1.06L8.94 11.5 6.72 9.28a.75.75 0 1 1 1.06-1.06L10 10.44l2.22-2.22a.75.75 0 1 1 1.06 1.06l-2.22 2.22 2.22 2.22a.75.75 0 1 1-1.06 1.06L10 12.56l-2.22 2.22a.75.75 0 0 1-1.06 0Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (status === "complete") {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="prc-h-3.5 prc-w-3.5 prc-text-green-500"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.707-9.293a1 1 0 0 0-1.414-1.414L9 10.586 7.707 9.293a1 1 0 0 0-1.414 1.414l2 2a1 1 0 0 0 1.414 0l4-4Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  // pending
  return <span className="prc-h-2 prc-w-2 prc-rounded-full prc-bg-text-secondary/40" aria-hidden />;
}
