import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the SDK so the provider's PromptRails client is fully controllable.
// `vi.hoisted` makes the mock object available inside the hoisted vi.mock
// factory (which runs above top-level `const` initializers).
const { executions } = vi.hoisted(() => ({
  executions: {
    tree: vi.fn(),
    approvalInbox: vi.fn(),
    approve: vi.fn(),
    deny: vi.fn(),
  },
}));

vi.mock("@promptrails/sdk", () => ({
  PromptRails: vi.fn(function PromptRailsMock() {
    return { executions };
  }),
}));

import { createPromptRailsProvider } from "../../providers/promptrails";

function makeProvider() {
  return createPromptRailsProvider({ apiKey: "pr_test", agentId: "agt_1" });
}

describe("createPromptRailsProvider (API v2)", () => {
  beforeEach(() => {
    executions.tree.mockReset();
    executions.approvalInbox.mockReset();
    executions.approve.mockReset();
    executions.deny.mockReset();
  });

  it("maps the execution tree into flat steps", async () => {
    executions.tree.mockResolvedValueOnce({
      id: "exec_root",
      agent_id: "agt_1",
      status: "running",
      input: {},
      output: { content: "partial" },
      error: "",
      created_at: "2026-07-27T00:00:00Z",
      children: [
        {
          id: "exec_child",
          agent_id: "agt_sub",
          status: "completed",
          input: { q: "1" },
          output: { a: "2" },
          error: "",
          duration_ms: 1200,
          started_at: "2026-07-27T00:00:01Z",
          completed_at: "2026-07-27T00:00:02Z",
          created_at: "2026-07-27T00:00:01Z",
          children: [],
        },
      ],
    });

    const provider = makeProvider();
    const result = await provider.getExecutionStatus!("exec_root");

    expect(executions.tree).toHaveBeenCalledWith("exec_root");
    expect(result.status).toBe("running");
    expect(result.steps).toHaveLength(1);
    expect(result.steps![0]).toMatchObject({
      id: "exec_child",
      name: "agt_sub",
      status: "completed",
      durationMs: 1200,
    });
  });

  it("surfaces waiting_approval as the execution status", async () => {
    executions.tree.mockResolvedValueOnce({
      id: "exec_root",
      agent_id: "agt_1",
      status: "waiting_approval",
      input: {},
      error: "",
      created_at: "2026-07-27T00:00:00Z",
      children: [],
    });

    const provider = makeProvider();
    const result = await provider.getExecutionStatus!("exec_root");

    expect(result.status).toBe("waiting_approval");
    expect(result.steps).toBeUndefined();
  });

  it("lists parked executions from the approval inbox", async () => {
    executions.approvalInbox.mockResolvedValueOnce({
      data: [
        {
          id: "exec_parked",
          agent_id: "agt_1",
          status: "waiting_approval",
          input: { action: "delete" },
          error: "",
          approval_expires_at: "2026-07-27T01:00:00Z",
          created_at: "2026-07-27T00:00:00Z",
          children: [],
        },
      ],
      meta: { total: 1 },
    });

    const provider = makeProvider();
    const approvals = await provider.listApprovals!();

    expect(executions.approvalInbox).toHaveBeenCalledWith({ page: 1, limit: 50 });
    expect(approvals).toHaveLength(1);
    expect(approvals[0]).toMatchObject({
      id: "exec_parked",
      executionId: "exec_parked",
      status: "pending",
      payload: { action: "delete" },
    });
    expect(approvals[0].approvalExpiresAt).toBeInstanceOf(Date);
  });

  it("approves via executions.approve", async () => {
    executions.approve.mockResolvedValueOnce({
      id: "exec_parked",
      agent_id: "agt_1",
      status: "running",
      input: {},
      error: "",
      created_at: "2026-07-27T00:00:00Z",
      children: [],
    });

    const provider = makeProvider();
    const result = await provider.decideApproval!("exec_parked", "approved", "looks good");

    expect(executions.approve).toHaveBeenCalledWith("exec_parked", { reason: "looks good" });
    expect(executions.deny).not.toHaveBeenCalled();
    expect(result.status).toBe("approved");
  });

  it("rejects via executions.deny", async () => {
    executions.deny.mockResolvedValueOnce({
      id: "exec_parked",
      agent_id: "agt_1",
      status: "running",
      input: {},
      error: "",
      created_at: "2026-07-27T00:00:00Z",
      children: [],
    });

    const provider = makeProvider();
    const result = await provider.decideApproval!("exec_parked", "rejected");

    expect(executions.deny).toHaveBeenCalledWith("exec_parked", undefined);
    expect(executions.approve).not.toHaveBeenCalled();
    expect(result.status).toBe("rejected");
  });
});
