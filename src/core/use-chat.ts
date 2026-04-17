import { type FormEvent, useCallback, useReducer, useRef, useState } from "react";
import type { Message, ToolCall, UseChatOptions } from "../types";
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
  const { provider, initialMessages, sessionId, onError, onFinish, stream = true } = options;

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
        if (stream) {
          // Streaming path — aggregates content deltas and tool calls into
          // the assistant message as events arrive.
          let accumulatedContent = "";
          let toolCalls: ToolCall[] = [];
          let executionId: string | undefined;
          let finished = false;

          // Mark the message as streaming for UI indicators.
          dispatch({
            type: "UPDATE_MESSAGE",
            id: assistantMessage.id,
            updates: { status: "streaming" },
          });

          const generator = provider.sendMessageStream({ content, sessionId }, controller.signal);

          try {
            for await (const event of generator) {
              if (controller.signal.aborted) break;

              if (event.type === "content" && event.content) {
                accumulatedContent += event.content;
                dispatch({
                  type: "UPDATE_MESSAGE",
                  id: assistantMessage.id,
                  updates: { content: accumulatedContent },
                });
              } else if (event.type === "tool_start" && event.toolCallId) {
                toolCalls = [
                  ...toolCalls,
                  {
                    id: event.toolCallId,
                    name: event.toolName ?? "",
                    arguments: {},
                    status: "running",
                  },
                ];
                dispatch({
                  type: "UPDATE_MESSAGE",
                  id: assistantMessage.id,
                  updates: { toolCalls },
                });
              } else if (event.type === "tool_end" && event.toolCallId) {
                const idx = toolCalls.findIndex((t) => t.id === event.toolCallId);
                const base: ToolCall =
                  idx >= 0
                    ? toolCalls[idx]
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
                toolCalls =
                  idx >= 0
                    ? toolCalls.map((t, i) => (i === idx ? updated : t))
                    : [...toolCalls, updated];
                dispatch({
                  type: "UPDATE_MESSAGE",
                  id: assistantMessage.id,
                  updates: { toolCalls },
                });
              } else if (event.type === "execution" && event.executionId) {
                executionId = event.executionId;
              } else if (event.type === "error") {
                throw new Error(event.error ?? "Stream error");
              } else if (event.type === "done") {
                // Non-tool executions emit the full response only on done
                // (no progressive content deltas). Fall back to the final
                // output payload so those messages still render.
                if (!accumulatedContent && event.output) {
                  const out = event.output as { content?: unknown };
                  if (typeof out.content === "string") {
                    accumulatedContent = out.content;
                    dispatch({
                      type: "UPDATE_MESSAGE",
                      id: assistantMessage.id,
                      updates: { content: accumulatedContent },
                    });
                  }
                }
                finished = true;
                break;
              }
            }
          } catch (streamErr) {
            if (!controller.signal.aborted) {
              throw streamErr;
            }
          }

          if (!controller.signal.aborted) {
            const finalMessage: Message = {
              ...assistantMessage,
              content: accumulatedContent,
              status: finished ? "complete" : "error",
              toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
              executionId,
            };
            dispatch({
              type: "UPDATE_MESSAGE",
              id: assistantMessage.id,
              updates: {
                status: finalMessage.status,
                executionId,
              },
            });
            onFinish?.(finalMessage);
          }
        } else {
          const result = await provider.sendMessage({ content, sessionId });

          if (!controller.signal.aborted) {
            dispatch({
              type: "UPDATE_MESSAGE",
              id: assistantMessage.id,
              updates: {
                content: result.message.content,
                status: "complete",
                executionId: result.executionId,
              },
            });

            onFinish?.(result.message);
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
    [provider, sessionId, onError, onFinish, stream, state.messages],
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
