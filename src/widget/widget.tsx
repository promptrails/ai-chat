import { useMemo, useState } from "react";
import type { ChatProvider } from "../providers/types";
import type { WidgetConfig } from "../types";
import { createCustomProvider } from "../providers/custom";
import { createOpenAIProvider } from "../providers/openai";
import { createPromptRailsProvider } from "../providers/promptrails";
import { Bubble } from "./bubble";
import { Panel } from "./panel";

interface WidgetProps {
  config: WidgetConfig;
}

export function Widget({ config }: WidgetProps) {
  const [isOpen, setIsOpen] = useState(false);

  const provider = useMemo<ChatProvider>(() => {
    const { type, ...rest } = config.provider;

    switch (type) {
      case "promptrails":
        return createPromptRailsProvider({
          baseUrl: (rest.baseUrl as string) ?? "",
          apiKey: (rest.apiKey as string) ?? "",
          workspaceId: (rest.workspaceId as string) ?? "",
          agentId: (rest.agentId as string) ?? "",
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

  return (
    <>
      <Panel isOpen={isOpen} config={config} provider={provider} onClose={() => setIsOpen(false)} />
      <Bubble isOpen={isOpen} position={position} onClick={() => setIsOpen(!isOpen)} />
    </>
  );
}
