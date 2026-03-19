import type { StreamEvent } from "../types";

let counter = 0;

/**
 * Generate a unique client-side ID.
 */
export function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  counter++;
  return `${Date.now().toString(36)}-${counter.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Parse a text/event-stream response into StreamEvents.
 */
export async function* parseSSEStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;

      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";

      let currentEvent = "";
      let currentData = "";

      for (const line of lines) {
        if (line.startsWith("event:")) {
          currentEvent = line.slice(6).trim();
        } else if (line.startsWith("data:")) {
          currentData = line.slice(5).trim();
        } else if (line === "") {
          // Empty line = event boundary
          if (currentData) {
            const event = parseSSEData(currentData, currentEvent);
            if (event) yield event;
          }
          currentEvent = "";
          currentData = "";
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

function parseSSEData(data: string, event: string): StreamEvent | null {
  if (data === "[DONE]") {
    return { type: "done" };
  }

  try {
    const parsed = JSON.parse(data);

    // OpenAI-compatible format
    if (parsed.choices) {
      const choice = parsed.choices[0];
      if (!choice) return null;

      const delta = choice.delta;
      if (delta?.content) {
        return { type: "content", content: delta.content };
      }
      if (choice.finish_reason) {
        return { type: "done" };
      }
      return null;
    }

    // PromptRails format
    if (parsed.type) {
      return parsed as StreamEvent;
    }

    // Named event format
    if (event === "status" && parsed.status) {
      return { type: "status", status: parsed.status };
    }
    if (event === "content" && parsed.content) {
      return { type: "content", content: parsed.content };
    }
    if (event === "error") {
      return {
        type: "error",
        error: parsed.error || parsed.message || "Unknown error",
      };
    }
    if (event === "done") {
      return { type: "done" };
    }

    // Fallback: treat as content if string-like
    if (typeof parsed.content === "string") {
      return { type: "content", content: parsed.content };
    }

    return null;
  } catch {
    // Non-JSON data, treat as raw content
    return { type: "content", content: data };
  }
}

/**
 * Retry a function with exponential backoff.
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  baseDelayMs = 1000,
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
