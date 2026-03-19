import { describe, expect, it } from "vitest";
import { generateId, retryWithBackoff } from "../../core/utils";

describe("generateId", () => {
  it("returns a string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id.length).toBeGreaterThan(0);
  });

  it("returns unique IDs", () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateId()));
    expect(ids.size).toBe(100);
  });
});

describe("retryWithBackoff", () => {
  it("returns on first success", async () => {
    const result = await retryWithBackoff(() => Promise.resolve("ok"), 3, 1);
    expect(result).toBe("ok");
  });

  it("retries on failure", async () => {
    let attempt = 0;
    const result = await retryWithBackoff(
      () => {
        attempt++;
        if (attempt < 3) throw new Error("fail");
        return Promise.resolve("ok");
      },
      3,
      1,
    );
    expect(result).toBe("ok");
    expect(attempt).toBe(3);
  });

  it("throws after max retries", async () => {
    await expect(
      retryWithBackoff(() => Promise.reject(new Error("always fails")), 2, 1),
    ).rejects.toThrow("always fails");
  });
});
