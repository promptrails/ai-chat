import { cn } from "../lib/cn";

interface ChatHeaderProps {
  title?: string;
  onClose?: () => void;
  className?: string;
}

export function ChatHeader({ title = "Chat", onClose, className }: ChatHeaderProps) {
  return (
    <div
      className={cn(
        "prc-flex prc-items-center prc-justify-between prc-border-b prc-border-gray-200 prc-bg-surface prc-px-4 prc-py-3",
        className,
      )}
    >
      <div className="prc-flex prc-items-center prc-gap-2">
        <div className="prc-h-2.5 prc-w-2.5 prc-rounded-full prc-bg-green-500" />
        <h2 className="prc-text-sm prc-font-semibold prc-text-text-primary">{title}</h2>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="prc-rounded-lg prc-p-1 prc-text-text-secondary prc-transition-colors hover:prc-bg-gray-100 hover:prc-text-text-primary"
          aria-label="Close chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="prc-h-5 prc-w-5"
          >
            <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
          </svg>
        </button>
      )}
    </div>
  );
}
