import type { TypingIndicatorProps } from "../types";
import { cn } from "../lib/cn";

export function TypingIndicator({ className, text }: TypingIndicatorProps) {
  return (
    <div className={cn("prc-flex prc-items-center prc-gap-2 prc-px-4 prc-py-2", className)}>
      <div className="prc-flex prc-gap-1">
        <span
          className="prc-h-2 prc-w-2 prc-rounded-full prc-bg-text-secondary prc-animate-bounce"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="prc-h-2 prc-w-2 prc-rounded-full prc-bg-text-secondary prc-animate-bounce"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="prc-h-2 prc-w-2 prc-rounded-full prc-bg-text-secondary prc-animate-bounce"
          style={{ animationDelay: "300ms" }}
        />
      </div>
      {text && <span className="prc-text-sm prc-text-text-secondary">{text}</span>}
    </div>
  );
}
