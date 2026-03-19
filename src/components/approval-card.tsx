import { useState } from "react";
import type { ApprovalCardProps } from "../types";
import { cn } from "../lib/cn";

export function ApprovalCard({
  request,
  onApprove,
  onReject,
  className,
  disabled = false,
}: ApprovalCardProps) {
  const [reason, setReason] = useState("");

  return (
    <div
      className={cn(
        "prc-mx-4 prc-rounded-xl prc-border prc-border-amber-200 prc-bg-amber-50 prc-p-4",
        className,
      )}
    >
      <div className="prc-mb-2 prc-flex prc-items-center prc-gap-2">
        <svg
          className="prc-h-5 prc-w-5 prc-text-amber-500"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
            clipRule="evenodd"
          />
        </svg>
        <span className="prc-text-sm prc-font-semibold prc-text-amber-800">Approval Required</span>
      </div>

      <p className="prc-mb-1 prc-text-xs prc-font-medium prc-text-amber-700">
        {request.checkpointName}
      </p>

      {Object.keys(request.payload).length > 0 && (
        <pre className="prc-mb-3 prc-max-h-24 prc-overflow-auto prc-rounded prc-bg-white prc-p-2 prc-text-xs prc-text-gray-700">
          {JSON.stringify(request.payload, null, 2)}
        </pre>
      )}

      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (optional)"
        disabled={disabled}
        className={cn(
          "prc-mb-3 prc-w-full prc-rounded-lg prc-border prc-border-amber-200 prc-bg-white prc-px-3 prc-py-1.5 prc-text-xs",
          "prc-outline-none focus:prc-border-amber-400 focus:prc-ring-1 focus:prc-ring-amber-400",
          "disabled:prc-cursor-not-allowed disabled:prc-opacity-50",
        )}
      />

      <div className="prc-flex prc-gap-2">
        <button
          onClick={() => onApprove(request.id, reason || undefined)}
          disabled={disabled}
          className={cn(
            "prc-flex-1 prc-rounded-lg prc-bg-green-600 prc-px-3 prc-py-1.5 prc-text-xs prc-font-medium prc-text-white",
            "prc-transition-colors hover:prc-bg-green-700",
            "disabled:prc-cursor-not-allowed disabled:prc-opacity-50",
          )}
        >
          Approve
        </button>
        <button
          onClick={() => onReject(request.id, reason || undefined)}
          disabled={disabled}
          className={cn(
            "prc-flex-1 prc-rounded-lg prc-bg-red-600 prc-px-3 prc-py-1.5 prc-text-xs prc-font-medium prc-text-white",
            "prc-transition-colors hover:prc-bg-red-700",
            "disabled:prc-cursor-not-allowed disabled:prc-opacity-50",
          )}
        >
          Reject
        </button>
      </div>
    </div>
  );
}
