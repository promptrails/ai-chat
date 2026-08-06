import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MessageBubble } from "../../components/message-bubble";
import type { Message } from "../../types";

function message(content: string): Message {
  return {
    id: "message-1",
    role: "assistant",
    content,
    status: "complete",
    createdAt: new Date("2026-08-06T00:00:00Z"),
  };
}

describe("MessageBubble links", () => {
  it("does not render executable markdown URLs", () => {
    const { container } = render(
      <MessageBubble message={message("[click](javascript:alert(1))")} />,
    );

    expect(container.querySelector("a")).toBeNull();
    expect(container).toHaveTextContent("click");
  });

  it("keeps safe external links isolated from the opener", () => {
    const { container } = render(
      <MessageBubble message={message("[docs](https://docs.promptrails.ai)")} />,
    );

    const link = container.querySelector("a");
    expect(link).toHaveAttribute("href", "https://docs.promptrails.ai");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
