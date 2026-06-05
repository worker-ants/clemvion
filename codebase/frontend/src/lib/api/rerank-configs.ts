import { apiClient } from "./client";

/**
 * React Query key for `rerankConfigsApi.list()`. Shared across components
 * (KB rerank-config selector dropdown) so that a single fetch is reused via
 * the query cache. Mirrors `LLM_CONFIGS_QUERY_KEY`.
 */
export const RERANK_CONFIGS_QUERY_KEY = ["rerank-configs"] as const;

export type RerankProvider = "tei" | "cohere";

export interface RerankConfigData {
  id: string;
  provider: RerankProvider;
  name: string;
  apiKey: string | null; // masked on read (null when no key, e.g. tei)
  baseUrl?: string | null;
  defaultModel: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const rerankConfigsApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await apiClient.get("/rerank-configs", { params });
    return data;
  },

  /**
   * Returns the full rerank config list as a flat `RerankConfigData[]`,
   * normalizing the `{ data: [...] }` envelope. Use this in components that
   * only need the array (selector dropdowns). Paginated views should keep
   * calling `getAll(params)` and pass the raw response to
   * `normalizePagedResponse`.
   *
   * Calls `apiClient.get` directly (does not call `getAll()`) to avoid sharing
   * the React Query cache key with paginated `getAll(params)` calls that use
   * different parameters (mirrors `llmConfigsApi.list`).
   */
  async list(): Promise<RerankConfigData[]> {
    const { data: raw } = await apiClient.get("/rerank-configs");
    const enveloped = (raw as { data?: RerankConfigData[] } | undefined)?.data;
    if (Array.isArray(enveloped)) return enveloped;
    if (Array.isArray(raw)) return raw as RerankConfigData[];
    return [];
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/rerank-configs/${id}`);
    return data;
  },

  async create(payload: {
    provider: RerankProvider;
    name: string;
    apiKey?: string;
    baseUrl?: string;
    defaultModel: string;
    isDefault?: boolean;
  }) {
    const { data } = await apiClient.post("/rerank-configs", payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      provider: RerankProvider;
      name: string;
      apiKey: string;
      baseUrl: string;
      defaultModel: string;
      isDefault: boolean;
    }>,
  ) {
    const { data } = await apiClient.patch(`/rerank-configs/${id}`, payload);
    return data;
  },

  async setDefault(id: string) {
    await apiClient.patch(`/rerank-configs/${id}/set-default`);
  },

  async remove(id: string) {
    await apiClient.delete(`/rerank-configs/${id}`);
  },
};
