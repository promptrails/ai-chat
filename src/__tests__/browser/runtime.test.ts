import { beforeEach, describe, expect, it, vi } from "vitest";
import { BrowserChatError, createBrowserChatRuntime } from "../../browser";

const SESSION_ID = "3E0A8svdnmVo1k9u7lfsNGyCFmg";
const RESUME_TOKEN = "resume-token-with-at-least-32-characters";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const stream = () =>
  new Response('event: done\ndata: {"output":{"message":"ok"}}\n\n', {
    status: 200,
    headers: { "Content-Type": "text/event-stream" },
  });
async function collect<T>(values: AsyncIterable<T>): Promise<T[]> {
  const result: T[] = [];
  for await (const value of values) result.push(value);
  return result;
}

describe("browser chat runtime", () => {
  const fetchMock = vi.fn();
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
  };

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
    Object.defineProperty(window, "localStorage", { configurable: true, value: storage });
    localStorage.clear();
  });

  it("deduplicates concurrent token and session creation", async () => {
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/token")) return json({ data: { access_token: "token", expires_in: 900 } });
      if (url.endsWith("/sessions")) {
        return json({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN } });
      }
      return stream();
    });
    const runtime = createBrowserChatRuntime({ apiKey: "browser", agentId: "agent" });

    await Promise.all([
      collect(runtime.sendMessageStream({ content: "one" })),
      collect(runtime.sendMessageStream({ content: "two" })),
    ]);

    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/token"))).toHaveLength(1);
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith("/sessions"))).toHaveLength(
      1,
    );
  });

  it("emits host-owned telemetry without leaking the bearer to storage", async () => {
    const events: string[] = [];
    fetchMock
      .mockResolvedValueOnce(json({ data: { access_token: "secret-token", expires_in: 900 } }))
      .mockResolvedValueOnce(json({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN } }))
      .mockResolvedValueOnce(stream());
    const runtime = createBrowserChatRuntime({
      apiKey: "browser",
      agentId: "agent",
      workspaceId: "workspace",
      onEvent: (event) => events.push(event.type),
    });

    await collect(runtime.sendMessageStream({ content: "hello" }));

    expect(events).toEqual([
      "token.refreshed",
      "session.created",
      "message.started",
      "message.completed",
    ]);
    expect(localStorage.getItem("promptrails-chat-widget:workspace:agent")).not.toContain(
      "secret-token",
    );
  });

  it("returns a normalized retryable network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const runtime = createBrowserChatRuntime({ apiKey: "browser", agentId: "agent" });

    await expect(collect(runtime.sendMessageStream({ content: "hello" }))).rejects.toMatchObject({
      status: 0,
      retryable: true,
    } satisfies Partial<BrowserChatError>);
  });
});
