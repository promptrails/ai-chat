import { useState } from "react";
import type { AgentStep, AgentStepsProps } from "../types";
import { cn } from "../lib/cn";

export function AgentSteps({ steps, className, collapsible = true }: AgentStepsProps) {
  const [isOpen, setIsOpen] = useState(true);

  if (steps.length === 0) return null;

  return (
    <div className={cn("prc-px-4 prc-py-2", className)}>
      {collapsible && (
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="prc-flex prc-items-center prc-gap-1 prc-text-xs prc-font-medium prc-text-text-secondary hover:prc-text-text-primary"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 20 20"
            fill="currentColor"
            className={cn("prc-h-4 prc-w-4 prc-transition-transform", isOpen && "prc-rotate-90")}
          >
            <path
              fillRule="evenodd"
              d="M7.21 14.77a.75.75 0 0 1 .02-1.06L11.168 10 7.23 6.29a.75.75 0 1 1 1.04-1.08l4.5 4.25a.75.75 0 0 1 0 1.08l-4.5 4.25a.75.75 0 0 1-1.06-.02Z"
              clipRule="evenodd"
            />
          </svg>
          Agent Steps ({steps.length})
        </button>
      )}

      {isOpen && (
        <div className="prc-mt-2 prc-space-y-1">
          {steps.map((step) => (
            <StepItem key={step.id} step={step} />
          ))}
        </div>
      )}
    </div>
  );
}

function StepItem({ step }: { step: AgentStep }) {
  return (
    <div className="prc-flex prc-items-center prc-gap-2 prc-rounded-lg prc-border prc-border-gray-100 prc-bg-white prc-px-3 prc-py-2">
      <StepStatusIcon status={step.status} />
      <span className="prc-flex-1 prc-text-xs prc-font-medium prc-text-text-primary">
        {step.name}
      </span>
      {step.durationMs != null && (
        <span className="prc-text-xs prc-text-text-secondary">
          {step.durationMs < 1000
            ? `${step.durationMs}ms`
            : `${(step.durationMs / 1000).toFixed(1)}s`}
        </span>
      )}
    </div>
  );
}

function StepStatusIcon({ status }: { status: AgentStep["status"] }) {
  switch (status) {
    case "completed":
      return (
        <svg
          className="prc-h-4 prc-w-4 prc-text-green-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "failed":
    case "rejected":
      return (
        <svg
          className="prc-h-4 prc-w-4 prc-text-red-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
            clipRule="evenodd"
          />
        </svg>
      );
    case "running":
    case "pending":
      return (
        <svg
          className="prc-h-4 prc-w-4 prc-animate-spin prc-text-primary"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle
            className="prc-opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="prc-opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>
      );
    default:
      return <div className="prc-h-4 prc-w-4 prc-rounded-full prc-border-2 prc-border-gray-300" />;
  }
}
