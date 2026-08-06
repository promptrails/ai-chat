import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ChatProvider } from "../providers/types";
import type { WidgetConfig } from "../types";
import { createCustomProvider } from "../providers/custom";
import { createOpenAIProvider } from "../providers/openai";
import { createPromptRailsBrowserProvider } from "../providers/promptrails-browser";
import { Bubble } from "./bubble";
import { Panel, type PanelHandle } from "./panel";

interface WidgetProps {
  config: WidgetConfig;
}

export interface WidgetHandle {
  open(): void;
  close(): void;
  toggle(): void;
  send(content: string): Promise<void>;
  newSession(): Promise<void>;
  updateContext(context: Record<string, unknown>): void;
}

export const Widget = forwardRef<WidgetHandle, WidgetProps>(function Widget({ config }, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const panelRef = useRef<PanelHandle>(null);

  const changeOpen = (next: boolean) => {
    setIsOpen(next);
    config.onEvent?.({ type: next ? "open" : "close" });
  };

  const provider = useMemo<ChatProvider>(() => {
    const { type, ...rest } = config.provider;

    switch (type) {
      case "promptrails":
        return createPromptRailsBrowserProvider({
          apiKey: (rest.apiKey as string) ?? "",
          agentId: (rest.agentId as string) ?? "",
          baseUrl: rest.baseUrl as string | undefined,
          workspaceId: config.workspaceId,
          title: config.title,
          persistSession: config.persistSession,
          sessionMaxAge: config.sessionMaxAge,
        });

      case "openai":
        return createOpenAIProvider({
          apiKey: (rest.apiKey as string) ?? "",
          baseUrl: rest.baseUrl as string | undefined,
          model: rest.model as string | undefined,
        });

      case "custom":
        return createCustomProvider({
          sendUrl: (rest.baseUrl as string) ?? "",
          headers: rest.headers as Record<string, string> | undefined,
        });

      default:
        throw new Error(`Unknown provider type: ${type}`);
    }
  }, [config.provider]);

  const position = config.position ?? "bottom-right";

  useImperativeHandle(
    ref,
    () => ({
      open: () => changeOpen(true),
      close: () => changeOpen(false),
      toggle: () => changeOpen(!isOpen),
      send: async (content) => {
        changeOpen(true);
        await panelRef.current?.send(content);
      },
      newSession: async () => panelRef.current?.newSession(),
      updateContext: (context) => panelRef.current?.updateContext(context),
    }),
    [isOpen],
  );

  return (
    <>
      <Panel
        ref={panelRef}
        isOpen={isOpen}
        config={config}
        provider={provider}
        onClose={() => changeOpen(false)}
      />
      <Bubble
        isOpen={isOpen}
        position={position}
        onClick={() => changeOpen(!isOpen)}
        openLabel={config.labels?.open}
        closeLabel={config.labels?.close}
      />
    </>
  );
});
