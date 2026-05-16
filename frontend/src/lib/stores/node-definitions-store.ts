"use client";

import { create } from "zustand";
import { nodeDefinitionsApi } from "@/lib/api/node-definitions";
import type {
  NodeCategory,
  NodeCategoryMeta,
  NodeDefinition,
  NodeDefinitionResponse,
} from "@/lib/node-definitions/types";

type Status = "idle" | "loading" | "ready" | "error";

interface NodeDefinitionsState {
  status: Status;
  error: string | null;
  definitions: Record<string, NodeDefinition>;
  order: string[];
  categories: NodeCategoryMeta[];
  load: () => Promise<void>;
}

function normalizeResponse(raw: NodeDefinitionResponse): NodeDefinition {
  return {
    type: raw.metadata.type,
    category: raw.metadata.category,
    label: raw.metadata.label,
    description: raw.metadata.description,
    icon: raw.metadata.icon,
    color: raw.metadata.color,
    inputs: raw.ports.inputs,
    outputs: raw.ports.outputs,
    isContainer: raw.metadata.isContainer,
    isDynamicPorts: raw.metadata.isDynamicPorts,
    dynamicPorts: raw.metadata.dynamicPorts,
    summaryTemplate: raw.metadata.summaryTemplate,
    warningRules: raw.metadata.warningRules,
    defaultConfig: raw.defaultConfig ?? {},
    configSchema: raw.configSchema,
    inputSchema: raw.inputSchema,
    outputSchema: raw.outputSchema,
    extras: raw.extras,
  };
}

type ParsedPayload = {
  definitions: NodeDefinitionResponse[];
  categories: NodeCategoryMeta[];
};

/**
 * Normalizes all response shapes into `{ definitions, categories }`.
 * Supports legacy `T[]`/`{ data: T[] }` payloads and the current
 * `{ definitions, categories }` / `{ data: { definitions, categories } }` shape.
 */
function parsePayload(raw: unknown): ParsedPayload {
  const unwrapped =
    raw && typeof raw === "object" && "data" in raw
      ? (raw as { data: unknown }).data
      : raw;

  if (Array.isArray(unwrapped)) {
    return { definitions: unwrapped as NodeDefinitionResponse[], categories: [] };
  }
  if (unwrapped && typeof unwrapped === "object") {
    const obj = unwrapped as {
      definitions?: NodeDefinitionResponse[];
      categories?: NodeCategoryMeta[];
    };
    return {
      definitions: Array.isArray(obj.definitions) ? obj.definitions : [],
      categories: Array.isArray(obj.categories) ? obj.categories : [],
    };
  }
  return { definitions: [], categories: [] };
}

let loadPromise: Promise<void> | null = null;

export const useNodeDefinitionsStore = create<NodeDefinitionsState>(
  (set, get) => ({
    status: "idle",
    error: null,
    definitions: {},
    order: [],
    categories: [],
    load: () => {
      const state = get();
      if (state.status === "ready") return Promise.resolve();
      if (loadPromise) return loadPromise;

      set({ status: "loading", error: null });
      loadPromise = nodeDefinitionsApi
        .list()
        .then((res) => {
          const { definitions: list, categories } = parsePayload(res.data);
          const definitions: Record<string, NodeDefinition> = {};
          const order: string[] = [];
          for (const raw of list) {
            const def = normalizeResponse(raw);
            definitions[def.type] = def;
            order.push(def.type);
          }
          set({
            status: "ready",
            error: null,
            definitions,
            order,
            categories,
          });
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error ? err.message : "Failed to load node definitions";
          set({ status: "error", error: message });
          throw err;
        })
        .finally(() => {
          loadPromise = null;
        });
      return loadPromise;
    },
  }),
);

/** Read-only selectors. Always read latest state for use outside components. */
export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return useNodeDefinitionsStore.getState().definitions[type];
}

export function getAllNodeDefinitions(): NodeDefinition[] {
  const { definitions, order } = useNodeDefinitionsStore.getState();
  return order.map((t) => definitions[t]).filter(Boolean);
}

export function getNodesByCategory(category: string): NodeDefinition[] {
  return getAllNodeDefinitions().filter((n) => n.category === category);
}

export function getCategories(): NodeCategoryMeta[] {
  return useNodeDefinitionsStore.getState().categories;
}

export function getCategoryColor(category: NodeCategory | string): string {
  const meta = useNodeDefinitionsStore
    .getState()
    .categories.find((c) => c.id === category);
  return meta?.color ?? "#6B7280";
}

export async function loadNodeDefinitions(): Promise<void> {
  await useNodeDefinitionsStore.getState().load();
}
