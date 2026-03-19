import { type FormEvent, useCallback, useReducer, useRef, useState } from "react";
import type { Message, UseChatOptions } from "../types";
import { initialState, messagesReducer } from "./message-store";
import { generateId } from "./utils";

export interface UseChatReturn {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
  sendMessage: (content: string) => Promise<void>;
  retry: (messageId: string) => Promise<void>;
  clearMessages: () => void;
  setMessages: (messages: Message[]) => void;
  input: string;
  setInput: (input: string) => void;
  handleSubmit: (e?: FormEvent) => void;
}

export function useChat(options: UseChatOptions): UseChatReturn {
  const { provider, initialMessages, sessionId, onError, onFinish } = options;

  const [state, dispatch] = useReducer(messagesReducer, {
    ...initialState,
    messages: initialMessages ?? [],
  });

  const [input, setInput] = useState("");
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      // Abort previous request
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const userMessage: Message = {
        id: generateId(),
        role: "user",
        content,
        status: "complete",
        createdAt: new Date(),
      };

      const assistantMessage: Message = {
        id: generateId(),
        role: "assistant",
        content: "",
        status: "pending",
        createdAt: new Date(),
      };

      dispatch({ type: "ADD_MESSAGE", message: userMessage });
      dispatch({ type: "ADD_MESSAGE", message: assistantMessage });
      dispatch({ type: "SET_LOADING", isLoading: true });
      dispatch({ type: "SET_ERROR", error: null });

      try {
        const stream = provider.sendMessageStream({ content, sessionId }, controller.signal);

        for await (const event of stream) {
          if (controller.signal.aborted) break;

          switch (event.type) {
            case "content":
              if (event.content) {
                dispatch({
                  type: "APPEND_CONTENT",
                  id: assistantMessage.id,
                  content: event.content,
                });
              }
              break;

            case "error":
              throw new Error(event.error ?? "Stream error");

            case "done":
              break;
          }
        }

        if (!controller.signal.aborted) {
          dispatch({
            type: "SET_STATUS",
            id: assistantMessage.id,
            status: "complete",
          });

          // Get the final message for onFinish callback
          const finalMessages = state.messages;
          const finalMsg = finalMessages.find((m) => m.id === assistantMessage.id);
          if (finalMsg) {
            onFinish?.(finalMsg);
          }
        }
      } catch (err) {
        if (!controller.signal.aborted) {
          const error = err instanceof Error ? err : new Error(String(err));
          dispatch({
            type: "SET_STATUS",
            id: assistantMessage.id,
            status: "error",
          });
          dispatch({
            type: "UPDATE_MESSAGE",
            id: assistantMessage.id,
            updates: {
              metadata: { error: error.message },
            },
          });
          dispatch({ type: "SET_ERROR", error });
          onError?.(error);
        }
      } finally {
        dispatch({ type: "SET_LOADING", isLoading: false });
      }
    },
    [provider, sessionId, onError, onFinish, state.messages],
  );

  const retry = useCallback(
    async (messageId: string) => {
      const messageIndex = state.messages.findIndex((m) => m.id === messageId);
      if (messageIndex < 0) return;

      // Find the preceding user message
      let userContent = "";
      for (let i = messageIndex; i >= 0; i--) {
        if (state.messages[i].role === "user") {
          userContent = state.messages[i].content;
          break;
        }
      }

      if (!userContent) return;

      // Remove the failed assistant message
      dispatch({ type: "REMOVE_MESSAGE", id: messageId });

      // Re-send
      await sendMessage(userContent);
    },
    [state.messages, sendMessage],
  );

  const clearMessages = useCallback(() => {
    abortRef.current?.abort();
    dispatch({ type: "CLEAR" });
  }, []);

  const setMessages = useCallback((messages: Message[]) => {
    dispatch({ type: "SET_MESSAGES", messages });
  }, []);

  const handleSubmit = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      if (input.trim()) {
        const content = input;
        setInput("");
        sendMessage(content);
      }
    },
    [input, sendMessage],
  );

  return {
    messages: state.messages,
    isLoading: state.isLoading,
    error: state.error,
    sendMessage,
    retry,
    clearMessages,
    setMessages,
    input,
    setInput,
    handleSubmit,
  };
}
