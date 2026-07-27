import { useCallback, useState } from "react";
import type { ApprovalRequest, UseApprovalOptions } from "../types";

export interface UseApprovalReturn {
  pendingApprovals: ApprovalRequest[];
  approve: (id: string, reason?: string) => Promise<void>;
  reject: (id: string, reason?: string) => Promise<void>;
  isDeciding: boolean;
  addApproval: (request: ApprovalRequest) => void;
  /**
   * Reload the pending-approval inbox from the provider. In API v2 this is the
   * set of executions parked at `waiting_approval`
   * (`provider.listApprovals`). No-op if the provider does not support it.
   */
  refresh: () => Promise<void>;
}

export function useApproval(options: UseApprovalOptions): UseApprovalReturn {
  const { provider, onApprovalRequired, onApprovalDecided } = options;

  const [pendingApprovals, setPendingApprovals] = useState<ApprovalRequest[]>([]);
  const [isDeciding, setIsDeciding] = useState(false);

  const addApproval = useCallback(
    (request: ApprovalRequest) => {
      setPendingApprovals((prev) => [...prev, request]);
      onApprovalRequired?.(request);
    },
    [onApprovalRequired],
  );

  const refresh = useCallback(async () => {
    if (!provider.listApprovals) return;
    const inbox = await provider.listApprovals();
    setPendingApprovals(inbox);
    for (const request of inbox) {
      onApprovalRequired?.(request);
    }
  }, [provider, onApprovalRequired]);

  const approve = useCallback(
    async (id: string, reason?: string) => {
      if (!provider.decideApproval) return;

      setIsDeciding(true);
      try {
        const result = await provider.decideApproval(id, "approved", reason);
        setPendingApprovals((prev) => prev.filter((a) => a.id !== id));
        onApprovalDecided?.(result);
      } finally {
        setIsDeciding(false);
      }
    },
    [provider, onApprovalDecided],
  );

  const reject = useCallback(
    async (id: string, reason?: string) => {
      if (!provider.decideApproval) return;

      setIsDeciding(true);
      try {
        const result = await provider.decideApproval(id, "rejected", reason);
        setPendingApprovals((prev) => prev.filter((a) => a.id !== id));
        onApprovalDecided?.(result);
      } finally {
        setIsDeciding(false);
      }
    },
    [provider, onApprovalDecided],
  );

  return {
    pendingApprovals,
    approve,
    reject,
    isDeciding,
    addApproval,
    refresh,
  };
}
