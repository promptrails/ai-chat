import { describe, expect, it } from "vitest";
import { initialState, messagesReducer } from "../../core/message-store";
import type { Message } from "../../types";

function createMessage(overrides: Partial<Message> = {}): Message {
  return {
    id: "msg-1",
    role: "user",
    content: "Hello",
    status: "complete",
    createdAt: new Date(),
    ...overrides,
  };
}

describe("messagesReducer", () => {
  it("adds a message", () => {
    const msg = createMessage();
    const state = messagesReducer(initialState, {
      type: "ADD_MESSAGE",
      message: msg,
    });
    expect(state.messages).toHaveLength(1);
    expect(state.messages[0]).toEqual(msg);
  });

  it("updates a message", () => {
    const msg = createMessage();
    const stateWithMsg = { ...initialState, messages: [msg] };
    const state = messagesReducer(stateWithMsg, {
      type: "UPDATE_MESSAGE",
      id: "msg-1",
      updates: { content: "Updated" },
    });
    expect(state.messages[0].content).toBe("Updated");
  });

  it("appends content to a message", () => {
    const msg = createMessage({
      id: "msg-1",
      role: "assistant",
      content: "Hello",
      status: "pending",
    });
    const stateWithMsg = { ...initialState, messages: [msg] };
    const state = messagesReducer(stateWithMsg, {
      type: "APPEND_CONTENT",
      id: "msg-1",
      content: " World",
    });
    expect(state.messages[0].content).toBe("Hello World");
    expect(state.messages[0].status).toBe("streaming");
  });

  it("sets message status", () => {
    const msg = createMessage({ status: "pending" });
    const stateWithMsg = { ...initialState, messages: [msg] };
    const state = messagesReducer(stateWithMsg, {
      type: "SET_STATUS",
      id: "msg-1",
      status: "complete",
    });
    expect(state.messages[0].status).toBe("complete");
  });

  it("removes a message", () => {
    const msg = createMessage();
    const stateWithMsg = { ...initialState, messages: [msg] };
    const state = messagesReducer(stateWithMsg, {
      type: "REMOVE_MESSAGE",
      id: "msg-1",
    });
    expect(state.messages).toHaveLength(0);
  });

  it("sets loading state", () => {
    const state = messagesReducer(initialState, {
      type: "SET_LOADING",
      isLoading: true,
    });
    expect(state.isLoading).toBe(true);
  });

  it("sets error state", () => {
    const error = new Error("test error");
    const state = messagesReducer(initialState, {
      type: "SET_ERROR",
      error,
    });
    expect(state.error).toBe(error);
  });

  it("sets messages", () => {
    const messages = [createMessage(), createMessage({ id: "msg-2" })];
    const state = messagesReducer(initialState, {
      type: "SET_MESSAGES",
      messages,
    });
    expect(state.messages).toHaveLength(2);
  });

  it("clears state", () => {
    const stateWithData = {
      messages: [createMessage()],
      isLoading: true,
      error: new Error("test"),
    };
    const state = messagesReducer(stateWithData, { type: "CLEAR" });
    expect(state).toEqual(initialState);
  });
});
