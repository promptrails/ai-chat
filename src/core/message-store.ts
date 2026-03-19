import type { Message } from "../types";

export interface MessagesState {
  messages: Message[];
  isLoading: boolean;
  error: Error | null;
}

export type MessagesAction =
  | { type: "ADD_MESSAGE"; message: Message }
  | { type: "UPDATE_MESSAGE"; id: string; updates: Partial<Message> }
  | { type: "APPEND_CONTENT"; id: string; content: string }
  | { type: "SET_STATUS"; id: string; status: Message["status"] }
  | { type: "REMOVE_MESSAGE"; id: string }
  | { type: "SET_LOADING"; isLoading: boolean }
  | { type: "SET_ERROR"; error: Error | null }
  | { type: "SET_MESSAGES"; messages: Message[] }
  | { type: "CLEAR" };

export const initialState: MessagesState = {
  messages: [],
  isLoading: false,
  error: null,
};

export function messagesReducer(state: MessagesState, action: MessagesAction): MessagesState {
  switch (action.type) {
    case "ADD_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case "UPDATE_MESSAGE":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.id ? { ...msg, ...action.updates } : msg,
        ),
      };

    case "APPEND_CONTENT":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.id
            ? {
                ...msg,
                content: msg.content + action.content,
                status: "streaming",
              }
            : msg,
        ),
      };

    case "SET_STATUS":
      return {
        ...state,
        messages: state.messages.map((msg) =>
          msg.id === action.id ? { ...msg, status: action.status } : msg,
        ),
      };

    case "REMOVE_MESSAGE":
      return {
        ...state,
        messages: state.messages.filter((msg) => msg.id !== action.id),
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };

    case "SET_ERROR":
      return { ...state, error: action.error };

    case "SET_MESSAGES":
      return { ...state, messages: action.messages };

    case "CLEAR":
      return { ...initialState };

    default:
      return state;
  }
}
