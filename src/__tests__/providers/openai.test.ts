import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createOpenAIProvider } from "../../providers/openai";

describe("createOpenAIProvider", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends a non-streaming message", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "chatcmpl-123",
          choices: [{ message: { content: "Hello!" } }],
        }),
    });

    const provider = createOpenAIProvider({
      apiKey: "test-key",
      model: "gpt-4o-mini",
    });

    const result = await provider.sendMessage({ content: "Hi" });

    expect(result.message.content).toBe("Hello!");
    expect(result.message.role).toBe("assistant");
    expect(result.message.status).toBe("complete");

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/chat/completions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-key",
        }),
      }),
    );
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
    });

    const provider = createOpenAIProvider({ apiKey: "bad-key" });

    await expect(provider.sendMessage({ content: "Hi" })).rejects.toThrow("OpenAI API error: 401");
  });

  it("clears history on disconnect", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          id: "chatcmpl-123",
          choices: [{ message: { content: "Hello!" } }],
        }),
    });

    const provider = createOpenAIProvider({ apiKey: "test-key" });

    await provider.sendMessage({ content: "Hi" });
    provider.disconnect?.();

    // After disconnect, next call should not include previous messages
    await provider.sendMessage({ content: "Hello again" });

    const secondCallBody = JSON.parse(mockFetch.mock.calls[1][1].body);
    expect(secondCallBody.messages).toHaveLength(1);
    expect(secondCallBody.messages[0].content).toBe("Hello again");
  });
});
