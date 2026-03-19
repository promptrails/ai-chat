import { type KeyboardEvent, useCallback, useEffect, useRef } from "react";
import type { MessageInputProps } from "../types";
import { cn } from "../lib/cn";

export function MessageInput({
  value,
  onChange,
  onSubmit,
  placeholder = "Type a message...",
  disabled = false,
  className,
}: MessageInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  }, [value]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (value.trim() && !disabled) {
          onSubmit();
        }
      }
    },
    [value, disabled, onSubmit],
  );

  return (
    <div
      className={cn(
        "prc-flex prc-items-end prc-gap-2 prc-border-t prc-border-gray-200 prc-bg-surface prc-p-3",
        className,
      )}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className={cn(
          "prc-flex-1 prc-resize-none prc-rounded-xl prc-border prc-border-gray-200 prc-bg-white prc-px-4 prc-py-2.5 prc-text-sm",
          "prc-outline-none prc-transition-colors",
          "focus:prc-border-primary focus:prc-ring-1 focus:prc-ring-primary",
          "disabled:prc-cursor-not-allowed disabled:prc-opacity-50",
          "placeholder:prc-text-text-secondary",
        )}
      />
      <button
        onClick={onSubmit}
        disabled={disabled || !value.trim()}
        className={cn(
          "prc-flex prc-h-10 prc-w-10 prc-shrink-0 prc-items-center prc-justify-center prc-rounded-full",
          "prc-bg-primary prc-text-white prc-transition-colors",
          "hover:prc-bg-primary-hover",
          "disabled:prc-cursor-not-allowed disabled:prc-opacity-50",
        )}
        aria-label="Send message"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="currentColor"
          className="prc-h-5 prc-w-5"
        >
          <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
        </svg>
      </button>
    </div>
  );
}
