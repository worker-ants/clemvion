import { apiClient } from "./client";
import { unwrap } from "./unwrap";

/**
 * React Query key for `llmConfigsApi.getAll()`. Shared across components
 * (canvas pre-fill, selector dropdown, custom-node summary) so that a single
 * fetch is reused via the query cache.
 */
export const LLM_CONFIGS_QUERY_KEY = ["llm-configs"] as const;

export interface LlmConfigData {
  id: string;
  provider: string;
  name: string;
  apiKey: string; // masked
  baseUrl?: string;
  defaultModel: string;
  defaultParams: Record<string, unknown>;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: "chat" | "embedding";
}

export const llmConfigsApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await apiClient.get("/llm-configs", { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/llm-configs/${id}`);
    return data;
  },

  async create(payload: {
    provider: string;
    name: string;
    apiKey: string;
    baseUrl?: string;
    defaultModel: string;
    defaultParams?: Record<string, unknown>;
    isDefault?: boolean;
  }) {
    const { data } = await apiClient.post("/llm-configs", payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      provider: string;
      name: string;
      apiKey: string;
      baseUrl: string;
      defaultModel: string;
      defaultParams: Record<string, unknown>;
      isDefault: boolean;
    }>,
  ) {
    const { data } = await apiClient.patch(`/llm-configs/${id}`, payload);
    return data;
  },

  async setDefault(id: string) {
    await apiClient.patch(`/llm-configs/${id}/set-default`);
  },

  async testConnection(id: string) {
    const response = await apiClient.post(`/llm-configs/${id}/test`);
    return unwrap<{ success: boolean; error?: string }>(response);
  },

  async listModels(id: string, opts?: { type?: "chat" | "embedding" }) {
    const response = await apiClient.get(`/llm-configs/${id}/models`, {
      params: opts?.type ? { type: opts.type } : undefined,
    });
    return unwrap<ModelInfo[]>(response);
  },

  async previewModels(payload: {
    provider: string;
    apiKey: string;
    baseUrl?: string;
  }) {
    const response = await apiClient.post(
      "/llm-configs/preview-models",
      payload,
    );
    return unwrap<ModelInfo[]>(response);
  },

  async remove(id: string) {
    await apiClient.delete(`/llm-configs/${id}`);
  },
};
