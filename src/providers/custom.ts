import type { StreamEvent } from "../types";
import { parseSSEStream } from "../core/utils";
import type { ChatProvider, SendMessageParams, SendMessageResult } from "./types";

export interface CustomProviderConfig {
  /** The URL to POST messages to. */
  sendUrl: string;
  /** Optional separate URL for streaming. Falls back to sendUrl with stream param. */
  streamUrl?: string;
  /** Additional headers to include in requests. */
  headers?: Record<string, string>;
  /** Transport mode for streaming. Defaults to "sse". */
  transport?: "sse" | "websocket";
  /**
   * Parse the response body into a SendMessageResult.
   * Defaults to extracting `{ message, executionId }` from JSON.
   */
  parseResponse?: (body: unknown) => SendMessageResult;
  /**
   * Build the request body from params.
   * Defaults to `{ content, sessionId, metadata }`.
   */
  buildRequestBody?: (params: SendMessageParams) => unknown;
}

export function createCustomProvider(config: CustomProviderConfig): ChatProvider {
  const {
    sendUrl,
    streamUrl,
    headers: customHeaders = {},
    transport = "sse",
    parseResponse,
    buildRequestBody,
  } = config;

  const defaultHeaders: Record<string, string> = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  function buildBody(params: SendMessageParams): string {
    if (buildRequestBody) {
      return JSON.stringify(buildRequestBody(params));
    }
    return JSON.stringify({
      content: params.content,
      session_id: params.sessionId,
      metadata: params.metadata,
    });
  }

  const provider: ChatProvider = {
    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      const response = await fetch(sendUrl, {
        method: "POST",
        headers: defaultHeaders,
        body: buildBody(params),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (parseResponse) {
        return parseResponse(data);
      }

      return {
        message: {
          id: data.id || data.message?.id || crypto.randomUUID(),
          role: "assistant",
          content: data.content || data.message?.content || JSON.stringify(data),
          status: "complete",
          createdAt: new Date(),
        },
        executionId: data.execution_id || data.executionId,
      };
    },

    async *sendMessageStream(
      params: SendMessageParams,
      signal?: AbortSignal,
    ): AsyncGenerator<StreamEvent> {
      const url = streamUrl || sendUrl;

      if (transport === "websocket") {
        yield* streamViaWebSocket(url, params, signal);
        return;
      }

      // SSE transport
      const response = await fetch(url, {
        method: "POST",
        headers: {
          ...defaultHeaders,
          Accept: "text/event-stream",
        },
        body: buildBody(params),
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      yield* parseSSEStream(response, signal);
    },
  };

  return provider;
}

async function* streamViaWebSocket(
  url: string,
  params: SendMessageParams,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const wsUrl = url.replace(/^http/, "ws");
  const ws = new WebSocket(wsUrl);

  const events: StreamEvent[] = [];
  let resolve: (() => void) | null = null;
  let done = false;
  let wsError: string | null = null;

  ws.onopen = () => {
    ws.send(
      JSON.stringify({
        content: params.content,
        session_id: params.sessionId,
        metadata: params.metadata,
      }),
    );
  };

  ws.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      const streamEvent: StreamEvent = data.type ? data : { type: "content", content: event.data };
      events.push(streamEvent);
      resolve?.();
    } catch {
      events.push({ type: "content", content: event.data });
      resolve?.();
    }
  };

  ws.onerror = () => {
    wsError = "WebSocket error";
    resolve?.();
  };

  ws.onclose = () => {
    done = true;
    resolve?.();
  };

  signal?.addEventListener("abort", () => {
    ws.close();
  });

  try {
    while (!done && !wsError) {
      if (events.length === 0) {
        await new Promise<void>((r) => {
          resolve = r;
        });
      }

      while (events.length > 0) {
        const event = events.shift()!;
        if (event.type === "done") {
          done = true;
          break;
        }
        yield event;
      }
    }

    if (wsError) {
      yield { type: "error" as const, error: wsError };
    }
  } finally {
    if (ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
  }
}
