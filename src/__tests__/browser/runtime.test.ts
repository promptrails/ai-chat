import { beforeEach, describe, expect, it, vi } from "vitest";
import { type BrowserChatError, createBrowserChatRuntime } from "../../browser";

const SESSION_ID = "3E0A8svdnmVo1k9u7lfsNGyCFmg";
const RESUME_TOKEN = "resume-token-with-at-least-32-characters";
const VISITOR_ID = "3E0AJVhuIignLUfxjSZE2CKt5Z1";

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

  it("keeps visitor tracking opt-in and reuses the server-issued visitor", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: { access_token: "token", expires_in: 900 } }))
      .mockResolvedValueOnce(
        json({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN, visitor_id: VISITOR_ID } }),
      )
      .mockResolvedValueOnce(json({ data: {} }))
      .mockResolvedValueOnce(
        json({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN, visitor_id: VISITOR_ID } }),
      );
    const runtime = createBrowserChatRuntime({
      apiKey: "browser",
      agentId: "agent",
      workspaceId: "workspace",
      visitorTracking: true,
    });

    await runtime.createSession();
    await runtime.newSession();
    await runtime.createSession();

    const firstRequest = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    const secondRequest = JSON.parse(String(fetchMock.mock.calls[3]?.[1]?.body));
    expect(firstRequest).toMatchObject({ visitor_tracking: true });
    expect(firstRequest).not.toHaveProperty("visitor_id");
    expect(secondRequest).toMatchObject({
      visitor_tracking: true,
      visitor_id: VISITOR_ID,
    });
    expect(
      JSON.parse(localStorage.getItem("promptrails-chat-widget:workspace:agent:visitor")!),
    ).toMatchObject({ visitorId: VISITOR_ID, createdAt: expect.any(Number) });
  });

  it("expires stored visitor identities and exposes an explicit reset", async () => {
    const visitorKey = "promptrails-chat-widget:workspace:agent:visitor";
    localStorage.setItem(visitorKey, JSON.stringify({ visitorId: VISITOR_ID, createdAt: 1 }));
    fetchMock
      .mockResolvedValueOnce(json({ data: { access_token: "token", expires_in: 900 } }))
      .mockResolvedValueOnce(
        json({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN, visitor_id: VISITOR_ID } }),
      );
    const runtime = createBrowserChatRuntime({
      apiKey: "browser",
      agentId: "agent",
      workspaceId: "workspace",
      visitorTracking: true,
      visitorMaxAge: 60,
    });

    await runtime.createSession();
    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(request).not.toHaveProperty("visitor_id");
    expect(localStorage.getItem(visitorKey)).not.toBeNull();

    runtime.clearVisitor();
    expect(localStorage.getItem(visitorKey)).toBeNull();
  });

  it("does not request visitor tracking by default", async () => {
    fetchMock
      .mockResolvedValueOnce(json({ data: { access_token: "token", expires_in: 900 } }))
      .mockResolvedValueOnce(json({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN } }));
    const runtime = createBrowserChatRuntime({ apiKey: "browser", agentId: "agent" });

    await runtime.createSession();

    const request = JSON.parse(String(fetchMock.mock.calls[1]?.[1]?.body));
    expect(request).not.toHaveProperty("visitor_tracking");
    expect(request).not.toHaveProperty("visitor_id");
  });

  it("returns a normalized retryable network error", async () => {
    fetchMock.mockRejectedValue(new TypeError("Failed to fetch"));
    const runtime = createBrowserChatRuntime({ apiKey: "browser", agentId: "agent" });

    await expect(collect(runtime.sendMessageStream({ content: "hello" }))).rejects.toMatchObject({
      status: 0,
      retryable: true,
    } satisfies Partial<BrowserChatError>);
  });

  it("reads the last page for the newest turn and the first page for restore", async () => {
    const pages: Record<string, unknown> = {
      "1": {
        data: [{ id: "m1", role: "assistant", content: "oldest", metadata: {} }],
        meta: { total: 60, page: 1, limit: 50, pages: 2 },
      },
      "2": {
        data: [
          {
            id: "m60",
            role: "assistant",
            content: JSON.stringify({ message: "newest" }),
            metadata: { execution_id: "exec-9" },
          },
        ],
        meta: { total: 60, page: 2, limit: 50, pages: 2 },
      },
    };
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith("/token")) return json({ data: { access_token: "token", expires_in: 900 } });
      if (url.endsWith("/sessions")) {
        return json({ data: { id: SESSION_ID, resume_token: RESUME_TOKEN } });
      }
      if (url.includes("/messages") && !url.includes("/stream")) {
        const page = new URL(url, "https://x").searchParams.get("page") ?? "1";
        return json(pages[page]);
      }
      return stream();
    });
    const runtime = createBrowserChatRuntime({ apiKey: "browser", agentId: "agent" });
    await collect(runtime.sendMessageStream({ content: "hi" })); // establish the session

    // tail: the newest turn lives on the last page, so recovery must read it.
    const tail = await runtime.listMessages({ tail: true });
    expect(tail.find((m) => m.executionId === "exec-9")).toBeTruthy();
    expect(
      fetchMock.mock.calls.some(
        ([u]) => String(u).includes("/messages") && String(u).includes("page=2"),
      ),
    ).toBe(true);

    // no tail (restore): only the first page is read, never page 2.
    fetchMock.mockClear();
    const head = await runtime.listMessages();
    expect(head.find((m) => m.content === "oldest")).toBeTruthy();
    expect(fetchMock.mock.calls.every(([u]) => !String(u).includes("page=2"))).toBe(true);
  });
});
