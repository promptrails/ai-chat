import type { StreamEvent } from "../types";
import { parseSSEStream } from "../core/utils";
import type { ChatProvider, SendMessageParams, SendMessageResult } from "./types";

export interface OpenAIProviderConfig {
  apiKey: string;
  baseUrl?: string;
  model?: string;
}

interface OpenAIMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export function createOpenAIProvider(config: OpenAIProviderConfig): ChatProvider {
  const { apiKey, baseUrl = "https://api.openai.com/v1", model = "gpt-4o-mini" } = config;

  // Maintain conversation history in-memory
  const conversationHistory: OpenAIMessage[] = [];

  const provider: ChatProvider = {
    async sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
      conversationHistory.push({ role: "user", content: params.content });

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: conversationHistory,
          stream: false,
        }),
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content ?? "";

      conversationHistory.push({ role: "assistant", content });

      return {
        message: {
          id: data.id || crypto.randomUUID(),
          role: "assistant",
          content,
          status: "complete",
          createdAt: new Date(),
        },
      };
    },

    async *sendMessageStream(
      params: SendMessageParams,
      signal?: AbortSignal,
    ): AsyncGenerator<StreamEvent> {
      conversationHistory.push({ role: "user", content: params.content });

      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: conversationHistory,
          stream: true,
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status}`);
      }

      let fullContent = "";

      for await (const event of parseSSEStream(response, signal)) {
        if (event.type === "content" && event.content) {
          fullContent += event.content;
        }
        yield event;
      }

      conversationHistory.push({ role: "assistant", content: fullContent });
    },

    disconnect() {
      conversationHistory.length = 0;
    },
  };

  return provider;
}
