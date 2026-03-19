import { useCallback, useRef, useState } from "react";
import type { StreamEvent, UseStreamingOptions } from "../types";

export interface UseStreamingReturn {
  isStreaming: boolean;
  content: string;
  error: Error | null;
  startStream: (generator: AsyncGenerator<StreamEvent>) => void;
  stopStream: () => void;
}

export function useStreaming(options: UseStreamingOptions = {}): UseStreamingReturn {
  const { onChunk, onComplete, onError } = options;

  const [isStreaming, setIsStreaming] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<Error | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const contentRef = useRef("");

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
      setError(null);
      contentRef.current = "";

      (async () => {
        try {
          for await (const event of generator) {
            if (controller.signal.aborted) break;

            if (event.type === "content" && event.content) {
              contentRef.current += event.content;
              setContent(contentRef.current);
              onChunk?.(event.content);
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
    [onChunk, onComplete, onError],
  );

  return { isStreaming, content, error, startStream, stopStream };
}
