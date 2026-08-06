import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
import type { PromptRailsBrowserProvider } from "../providers/promptrails-browser";
import type { ChatProvider } from "../providers/types";
import type { Message, WidgetConfig } from "../types";
import { generateId } from "../core/utils";

interface PanelProps {
  isOpen: boolean;
  config: WidgetConfig;
  provider: ChatProvider;
  onClose: () => void;
}

export function Panel({ isOpen, config, provider, onClose }: PanelProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const browserProvider = provider as ChatProvider & Partial<PromptRailsBrowserProvider>;

  useEffect(() => {
    let active = true;
    if (browserProvider.hydrate) {
      browserProvider
        .hydrate()
        .then((restored) => {
          if (active) setMessages(restored);
        })
        .catch(() => {
          // A stale or unavailable persisted session starts fresh.
        });
    }
    return () => {
      active = false;
      provider.disconnect?.();
    };
  }, [provider]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading, scrollToBottom]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
  }, [input]);

  const sendMessage = useCallback(async () => {
    const content = input.trim();
    if (!content || isLoading) return;

    setInput("");
    setIsLoading(true);

    const userMsg: Message = {
      id: generateId(),
      role: "user",
      content,
      status: "complete",
      createdAt: new Date(),
    };

    const assistantMsg: Message = {
      id: generateId(),
      role: "assistant",
      content: "",
      status: "pending",
      createdAt: new Date(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);

    try {
      let streamedContent = "";
      let executionId: string | undefined;
      let finalOutput: unknown;

      for await (const event of provider.sendMessageStream({ content })) {
        if (event.type === "content" && event.content) {
          streamedContent += event.content;
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMsg.id
                ? { ...message, content: streamedContent, status: "streaming" }
                : message,
            ),
          );
        } else if (event.type === "execution") {
          executionId = event.executionId;
        } else if (event.type === "error") {
          throw new Error(event.error || "Stream error");
        } else if (event.type === "done") {
          finalOutput = event.output;
        }
      }

      if (!streamedContent && finalOutput) {
        const output = finalOutput as { content?: unknown; message?: unknown; answer?: unknown };
        const candidate = output?.content ?? output?.message ?? output?.answer ?? finalOutput;
        streamedContent = typeof candidate === "string" ? candidate : "";
      }

      setMessages((prev) =>
        prev.map((message) =>
          message.id === assistantMsg.id
            ? {
                ...message,
                content: streamedContent,
                status: "complete",
                executionId,
              }
            : message,
        ),
      );
    } catch (err) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content:
                  config.errorMessage ?? "Chat is temporarily unavailable. Please try again.",
                status: "error",
                metadata: { error: err instanceof Error ? err.message : String(err) },
              }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [config.errorMessage, input, isLoading, provider]);

  const startNewSession = useCallback(async () => {
    setMessages([]);
    setInput("");
    await browserProvider.newSession?.();
    textareaRef.current?.focus();
  }, [browserProvider]);

  const submitFeedback = useCallback(
    async (messageId: string, executionId: string, value: 1 | -1) => {
      setMessages((current) =>
        current.map((message) =>
          message.id === messageId
            ? { ...message, metadata: { ...message.metadata, feedback: value } }
            : message,
        ),
      );
      try {
        await browserProvider.submitFeedback?.(executionId, value);
      } catch {
        setMessages((current) =>
          current.map((message) => {
            if (message.id !== messageId) return message;
            const metadata = { ...message.metadata };
            delete metadata.feedback;
            return { ...message, metadata };
          }),
        );
      }
    },
    [browserProvider],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    },
    [sendMessage],
  );

  const position = config.position ?? "bottom-right";

  return (
    <div
      className={`prc-widget-panel prc-widget-panel--${position} ${!isOpen ? "prc-widget-panel--hidden" : ""}`}
    >
      {/* Header */}
      <div className="prc-widget-header">
        <div className="prc-widget-header-title">
          <span className="prc-widget-header-dot" />
          {config.title ?? "Chat"}
        </div>
        <div className="prc-widget-header-actions">
          {browserProvider.newSession && (
            <button
              className="prc-widget-header-new"
              onClick={startNewSession}
              aria-label={config.newSessionLabel}
              title={config.newSessionLabel}
              disabled={isLoading}
            >
              +
            </button>
          )}
          <button className="prc-widget-header-close" onClick={onClose} aria-label="Close chat">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              width="18"
              height="18"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="prc-widget-messages">
        {messages.length === 0 && config.greeting && (
          <div className="prc-widget-greeting">{config.greeting}</div>
        )}

        {messages.length === 0 && !config.greeting && (
          <div className="prc-widget-empty">Start a conversation</div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`prc-widget-msg prc-widget-msg--${msg.role}`}>
            <div>
              <div className="prc-widget-msg-content">{msg.content}</div>
              {msg.role === "assistant" && msg.executionId && browserProvider.submitFeedback && (
                <div className="prc-widget-feedback" aria-label={config.feedbackLabel}>
                  <span>{config.feedbackLabel}</span>
                  <button
                    type="button"
                    aria-label="Helpful"
                    aria-pressed={msg.metadata?.feedback === 1}
                    onClick={() => submitFeedback(msg.id, msg.executionId!, 1)}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    aria-label="Not helpful"
                    aria-pressed={msg.metadata?.feedback === -1}
                    onClick={() => submitFeedback(msg.id, msg.executionId!, -1)}
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="prc-widget-typing">
            <span className="prc-widget-typing-dot" />
            <span className="prc-widget-typing-dot" />
            <span className="prc-widget-typing-dot" />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="prc-widget-input-area">
        <textarea
          ref={textareaRef}
          className="prc-widget-textarea"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={config.placeholder ?? "Type a message..."}
          rows={1}
          disabled={isLoading}
        />
        <button
          className="prc-widget-send"
          onClick={sendMessage}
          disabled={isLoading || !input.trim()}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
          </svg>
        </button>
      </div>
    </div>
  );
}
