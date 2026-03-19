import { type KeyboardEvent, useCallback, useEffect, useRef, useState } from "react";
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
      const result = await provider.sendMessage({ content });

      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: result.message.content, status: "complete" }
            : m,
        ),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Something went wrong";
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? {
                ...m,
                content: errorMessage,
                status: "error",
              }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, provider]);

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
        <button className="prc-widget-header-close" onClick={onClose}>
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
            <div className="prc-widget-msg-content">{msg.content}</div>
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
