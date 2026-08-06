import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPromptRailsBrowserProvider } from "../../providers/promptrails-browser";

const SESSION_ID = "3E0A8svdnmVo1k9u7lfsNGyCFmg";
const RESUME_TOKEN = "resume-token-with-at-least-32-characters";

class MemoryStorage implements Storage {
  private readonly values = new Map<string, string>();
  get length() {
    return this.values.size;
  }
  clear() {
    this.values.clear();
  }
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("createPromptRailsBrowserProvider", () => {
  const mockFetch = vi.fn();
  const testStorage = new MemoryStorage();

  beforeEach(() => {
    mockFetch.mockReset();
    vi.stubGlobal("fetch", mockFetch);
    testStorage.clear();
    Object.defineProperty(window, "localStorage", { configurable: true, value: testStorage });
  });

  it("exchanges a restricted browser key and streams through a resumable session", async () => {
    mockFetch
      .mockResolvedValueOnce(
        jsonResponse({ data: { access_token: "short-lived-token", expires_in: 900 } }),
      )
      .mockResolvedValueOnce(jsonResponse({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN } }))
      .mockResolvedValueOnce(
        new Response(
          [
            'event: execution\ndata: {"execution_id":"exec_1"}',
            'event: content\ndata: {"content":"Merhaba"}',
            'event: done\ndata: {"output":{"content":"Merhaba"}}',
            "",
          ].join("\n\n"),
          { status: 200, headers: { "Content-Type": "text/event-stream" } },
        ),
      );

    const provider = createPromptRailsBrowserProvider({
      apiKey: "browser-key",
      agentId: "agent_1",
      baseUrl: "https://api.example.test",
      workspaceId: "workspace_1",
    });
    const result = await provider.sendMessage({
      content: "Selam",
      context: { path: "/urun/elbise" },
      idempotencyKey: "message-1",
    });

    expect(result.message.content).toBe("Merhaba");
    expect(result.executionId).toBe("exec_1");
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[0][0]).toBe("https://api.example.test/api/v1/browser/chat/token");
    expect(mockFetch.mock.calls[0][1].headers["X-API-Key"]).toBe("browser-key");
    expect(mockFetch.mock.calls[2][1].headers.Authorization).toBe("Bearer short-lived-token");
    expect(mockFetch.mock.calls[2][1].headers["X-Chat-Resume-Token"]).toBe(RESUME_TOKEN);
    expect(JSON.parse(mockFetch.mock.calls[2][1].body)).toEqual({
      content: "Selam",
      client_context: { path: "/urun/elbise" },
      idempotency_key: "message-1",
    });

    const persisted = JSON.parse(
      testStorage.getItem("promptrails-chat-widget:workspace_1:agent_1") || "{}",
    );
    expect(persisted).toMatchObject({ sessionId: SESSION_ID, resumeToken: RESUME_TOKEN });
    expect(persisted).not.toHaveProperty("accessToken");
  });

  it("restores messages only after the API verifies the resume token", async () => {
    testStorage.setItem(
      "promptrails-chat-widget:workspace_1:agent_1",
      JSON.stringify({
        sessionId: SESSION_ID,
        resumeToken: RESUME_TOKEN,
        lastActivityAt: Date.now(),
      }),
    );
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ data: { access_token: "runtime-token" } }))
      .mockResolvedValueOnce(
        jsonResponse({
          data: [
            {
              id: "message_1",
              role: "assistant",
              content: "Tekrar hoş geldiniz",
              created_at: "2026-08-06T00:00:00Z",
              metadata: { execution_id: "exec_1" },
            },
          ],
        }),
      );

    const provider = createPromptRailsBrowserProvider({
      apiKey: "browser-key",
      agentId: "agent_1",
      baseUrl: "https://api.example.test",
      workspaceId: "workspace_1",
    });
    const messages = await provider.hydrate();

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ content: "Tekrar hoş geldiniz", executionId: "exec_1" });
    expect(mockFetch.mock.calls[1][1].headers["X-Chat-Resume-Token"]).toBe(RESUME_TOKEN);
  });

  it("drops an expired local session without sending it to the API", async () => {
    testStorage.setItem(
      "promptrails-chat-widget:workspace_1:agent_1",
      JSON.stringify({
        sessionId: SESSION_ID,
        resumeToken: RESUME_TOKEN,
        lastActivityAt: Date.now() - 25 * 60 * 60 * 1000,
      }),
    );

    const provider = createPromptRailsBrowserProvider({
      apiKey: "browser-key",
      agentId: "agent_1",
      workspaceId: "workspace_1",
    });

    await expect(provider.hydrate()).resolves.toEqual([]);
    expect(mockFetch).not.toHaveBeenCalled();
    expect(testStorage.getItem("promptrails-chat-widget:workspace_1:agent_1")).toBeNull();
  });

  it("refreshes an expired runtime token once", async () => {
    testStorage.setItem(
      "promptrails-chat-widget:workspace_1:agent_1",
      JSON.stringify({
        sessionId: SESSION_ID,
        resumeToken: RESUME_TOKEN,
        lastActivityAt: Date.now(),
      }),
    );
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ data: { access_token: "expired-token" } }))
      .mockResolvedValueOnce(jsonResponse({ error: "expired" }, 401))
      .mockResolvedValueOnce(jsonResponse({ data: { access_token: "fresh-token" } }))
      .mockResolvedValueOnce(jsonResponse({ data: [] }));

    const provider = createPromptRailsBrowserProvider({
      apiKey: "browser-key",
      agentId: "agent_1",
      baseUrl: "https://api.example.test",
      workspaceId: "workspace_1",
    });

    await expect(provider.hydrate()).resolves.toEqual([]);
    expect(mockFetch.mock.calls[3][1].headers.Authorization).toBe("Bearer fresh-token");
  });
});
