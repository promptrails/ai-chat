export interface ChatUIResource {
  id: string;
  kind: string;
  attributes: Record<string, unknown>;
}

export interface ChatUIAction {
  id?: string;
  kind: string;
  resourceId?: string;
  label?: string;
  payload: Record<string, unknown>;
}

export interface ChatUISuggestion {
  label: string;
  value: string;
}

export interface NormalizedChatUI {
  version: "1";
  resources: ChatUIResource[];
  actions: ChatUIAction[];
  suggestions: ChatUISuggestion[];
}

export interface ChatUIRenderer<T = unknown> {
  kind: string;
  render(resource: ChatUIResource, actions: ChatUIAction[]): T;
}

export interface ChatUIRendererRegistry<T = unknown> {
  register(renderer: ChatUIRenderer<T>): () => void;
  render(resource: ChatUIResource, actions: ChatUIAction[]): T | undefined;
  has(kind: string): boolean;
}

function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export function normalizeChatUI(value: unknown): NormalizedChatUI | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (String(candidate.version) !== "1") return null;

  const resources = (Array.isArray(candidate.resources) ? candidate.resources : [])
    .map((item): ChatUIResource | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const id = text(record.id, 128);
      const kind = text(record.kind, 64);
      if (!id || !kind) return null;
      const attributes =
        record.attributes && typeof record.attributes === "object"
          ? (record.attributes as Record<string, unknown>)
          : {};
      return { id, kind, attributes };
    })
    .filter((item): item is ChatUIResource => item !== null)
    .slice(0, 20);

  const resourceIDs = new Set(resources.map((resource) => resource.id));
  const actions = (Array.isArray(candidate.actions) ? candidate.actions : [])
    .map((item): ChatUIAction | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const kind = text(record.kind, 64);
      const resourceId = text(record.resource_id, 128) || undefined;
      if (!kind || (resourceId && !resourceIDs.has(resourceId))) return null;
      return {
        id: text(record.id, 128) || undefined,
        kind,
        resourceId,
        label: text(record.label, 80) || undefined,
        payload:
          record.payload && typeof record.payload === "object"
            ? (record.payload as Record<string, unknown>)
            : {},
      };
    })
    .filter((item): item is ChatUIAction => item !== null)
    .slice(0, 40);

  const suggestions = (Array.isArray(candidate.suggestions) ? candidate.suggestions : [])
    .map((item): ChatUISuggestion | null => {
      if (!item || typeof item !== "object") return null;
      const record = item as Record<string, unknown>;
      const label = text(record.label, 100);
      const suggestionValue = text(record.value, 500);
      return label && suggestionValue ? { label, value: suggestionValue } : null;
    })
    .filter((item): item is ChatUISuggestion => item !== null)
    .slice(0, 5);

  return { version: "1", resources, actions, suggestions };
}

export function createChatUIRendererRegistry<T = unknown>(
  initial: ChatUIRenderer<T>[] = [],
): ChatUIRendererRegistry<T> {
  const renderers = new Map(initial.map((renderer) => [renderer.kind, renderer]));
  return {
    register(renderer) {
      renderers.set(renderer.kind, renderer);
      return () => {
        if (renderers.get(renderer.kind) === renderer) renderers.delete(renderer.kind);
      };
    },
    render(resource, actions) {
      return renderers.get(resource.kind)?.render(
        resource,
        actions.filter((action) => action.resourceId === resource.id),
      );
    },
    has: (kind) => renderers.has(kind),
  };
}
