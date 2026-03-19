import { useCallback, useRef, useState } from "react";
import type { AgentStep, UseAgentOptions } from "../types";

export interface UseAgentReturn {
  steps: AgentStep[];
  currentStep: AgentStep | null;
  isRunning: boolean;
  error: Error | null;
  trackExecution: (executionId: string) => void;
  cancel: () => void;
}

const TERMINAL_STATUSES = new Set(["completed", "failed", "cancelled", "rejected"]);

export function useAgent(options: UseAgentOptions): UseAgentReturn {
  const { provider, onStepUpdate, onComplete, onError, pollIntervalMs = 1000 } = options;

  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef(false);

  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const trackExecution = useCallback(
    (executionId: string) => {
      if (!provider.getExecutionStatus) {
        return;
      }

      cancel();
      cancelledRef.current = false;
      setSteps([]);
      setError(null);
      setIsRunning(true);

      const poll = async () => {
        if (cancelledRef.current) return;

        try {
          const result = await provider.getExecutionStatus!(executionId);

          if (cancelledRef.current) return;

          if (result.steps) {
            setSteps(result.steps);
            const latest = result.steps[result.steps.length - 1];
            if (latest) {
              onStepUpdate?.(latest);
            }
          }

          if (TERMINAL_STATUSES.has(result.status) || result.status === "awaiting_approval") {
            cancel();
            if (result.steps) {
              onComplete?.(result.steps);
            }
            if (result.status === "failed" && result.error) {
              const err = new Error(result.error);
              setError(err);
              onError?.(err);
            }
          }
        } catch (err) {
          if (!cancelledRef.current) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onError?.(error);
            cancel();
          }
        }
      };

      // Initial poll
      poll();
      intervalRef.current = setInterval(poll, pollIntervalMs);
    },
    [provider, pollIntervalMs, onStepUpdate, onComplete, onError, cancel],
  );

  const currentStep = steps.length > 0 ? (steps[steps.length - 1] ?? null) : null;

  return {
    steps,
    currentStep,
    isRunning,
    error,
    trackExecution,
    cancel,
  };
}
