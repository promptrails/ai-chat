import { describe, expect, it } from "vitest";
import { createChatUIRendererRegistry, normalizeChatUI } from "../../ui";

describe("chat UI protocol", () => {
  it("normalizes allowlisted declarative data and drops dangling actions", () => {
    const ui = normalizeChatUI({
      version: "1",
      resources: [{ id: "p1", kind: "product", attributes: { reason: "Good fit" } }],
      actions: [
        { kind: "cart.add", resource_id: "p1", label: "Add" },
        { kind: "script.execute", resource_id: "missing", payload: { code: "alert(1)" } },
      ],
      suggestions: [{ label: "More", value: "Show more" }],
    });

    expect(ui?.resources).toHaveLength(1);
    expect(ui?.actions).toEqual([
      {
        id: undefined,
        kind: "cart.add",
        resourceId: "p1",
        label: "Add",
        payload: {},
      },
    ]);
  });

  it("supports host-owned renderers without coupling the runtime to a framework", () => {
    const registry = createChatUIRendererRegistry<string>();
    const unregister = registry.register({
      kind: "product",
      render: (resource) => `product:${resource.id}`,
    });
    expect(registry.render({ id: "p1", kind: "product", attributes: {} }, [])).toBe("product:p1");
    unregister();
    expect(registry.has("product")).toBe(false);
  });
});
