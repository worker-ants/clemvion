import { apiClient } from "./client";

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
    const { data } = await apiClient.post(`/llm-configs/${id}/test`);
    return data as { success: boolean; error?: string };
  },

  async listModels(id: string) {
    const { data } = await apiClient.get(`/llm-configs/${id}/models`);
    return data as ModelInfo[];
  },

  async remove(id: string) {
    await apiClient.delete(`/llm-configs/${id}`);
  },
};
