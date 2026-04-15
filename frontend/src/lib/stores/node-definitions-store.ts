"use client";

import { create } from "zustand";
import { nodeDefinitionsApi } from "@/lib/api/node-definitions";
import type {
  NodeDefinition,
  NodeDefinitionResponse,
} from "@/lib/node-definitions/types";

type Status = "idle" | "loading" | "ready" | "error";

interface NodeDefinitionsState {
  status: Status;
  error: string | null;
  definitions: Record<string, NodeDefinition>;
  order: string[];
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
    defaultConfig: raw.defaultConfig ?? {},
    configSchema: raw.configSchema,
    inputSchema: raw.inputSchema,
    outputSchema: raw.outputSchema,
  };
}

let loadPromise: Promise<void> | null = null;

export const useNodeDefinitionsStore = create<NodeDefinitionsState>(
  (set, get) => ({
    status: "idle",
    error: null,
    definitions: {},
    order: [],
    load: () => {
      const state = get();
      if (state.status === "ready") return Promise.resolve();
      if (loadPromise) return loadPromise;

      set({ status: "loading", error: null });
      loadPromise = nodeDefinitionsApi
        .list()
        .then((res) => {
          const payload = res.data as
            | { data: NodeDefinitionResponse[] }
            | NodeDefinitionResponse[];
          const list = Array.isArray(payload) ? payload : payload.data;
          const definitions: Record<string, NodeDefinition> = {};
          const order: string[] = [];
          for (const raw of list) {
            const def = normalizeResponse(raw);
            definitions[def.type] = def;
            order.push(def.type);
          }
          set({ status: "ready", error: null, definitions, order });
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

export async function loadNodeDefinitions(): Promise<void> {
  await useNodeDefinitionsStore.getState().load();
}
