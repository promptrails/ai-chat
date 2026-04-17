import { useCallback, useRef, useState } from "react";
import type { StreamEvent, ToolCall, UseStreamingOptions } from "../types";

export interface UseStreamingReturn {
  isStreaming: boolean;
  content: string;
  /**
   * Tool calls streamed so far. Each entry starts with status "running" on
   * tool_start and flips to "complete" on tool_end (carrying the summary
   * from the backend as `result`).
   */
  toolCalls: ToolCall[];
  /** Latest intermediate reasoning text emitted between tool rounds. */
  thinking: string;
  error: Error | null;
  startStream: (generator: AsyncGenerator<StreamEvent>) => void;
  stopStream: () => void;
}

export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const { onChunk, onComplete, onError, onToolStart, onToolEnd, onThinking } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [content, setContent] = useState("");
  const [toolCalls, setToolCalls] = useState<ToolCall[]>([]);
  const [thinking, setThinking] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef("");
  const toolCallsRef = useRef<ToolCall[]>([]);

  const stopStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const startStream = useCallback(
    (generator: AsyncGenerator<StreamEvent>) => {
      // Abort any existing stream
      abortRef.current?.abort();

      const controller = new AbortController();
      abortRef.current = controller;

      setIsStreaming(true);
      setContent("");
      setToolCalls([]);
      setThinking("");
      setError(null);
      contentRef.current = "";
      toolCallsRef.current = [];

      (async () => {
        try {
          for await (const event of generator) {
            if (controller.signal.aborted) break;

            if (event.type === "content" && event.content) {
              contentRef.current += event.content;
              setContent(contentRef.current);
              onChunk?.(event.content);
            } else if (event.type === "thinking" && typeof event.thinking === "string") {
              setThinking(event.thinking);
              onThinking?.(event.thinking);
            } else if (event.type === "tool_start" && event.toolCallId) {
              const tc: ToolCall = {
                id: event.toolCallId,
                name: event.toolName ?? "",
                arguments: {},
                status: "running",
              };
              toolCallsRef.current = [...toolCallsRef.current, tc];
              setToolCalls(toolCallsRef.current);
              onToolStart?.(tc);
            } else if (event.type === "tool_end" && event.toolCallId) {
              const idx = toolCallsRef.current.findIndex((t) => t.id === event.toolCallId);
              const base: ToolCall =
                idx >= 0
                  ? toolCallsRef.current[idx]
                  : {
                      id: event.toolCallId,
                      name: event.toolName ?? "",
                      arguments: {},
                      status: "running",
                    };
              const updated: ToolCall = {
                ...base,
                name: event.toolName || base.name,
                result: event.toolSummary,
                status: "complete",
              };
              toolCallsRef.current =
                idx >= 0
                  ? toolCallsRef.current.map((t, i) => (i === idx ? updated : t))
                  : [...toolCallsRef.current, updated];
              setToolCalls(toolCallsRef.current);
              onToolEnd?.(updated);
            } else if (event.type === "error") {
              const err = new Error(event.error ?? "Stream error");
              setError(err);
              onError?.(err);
              break;
            } else if (event.type === "done") {
              break;
            }
          }

          if (!controller.signal.aborted) {
            onComplete?.(contentRef.current);
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            const error = err instanceof Error ? err : new Error(String(err));
            setError(error);
            onError?.(error);
          }
        } finally {
          setIsStreaming(false);
        }
      })();
    },
    [onChunk, onComplete, onError, onToolStart, onToolEnd, onThinking],
  );

  return { isStreaming, content, toolCalls, thinking, error, startStream, stopStream };
}
