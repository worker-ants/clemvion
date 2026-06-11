import { apiClient } from "./client";
import { unwrap } from "./unwrap";

/**
 * 통합 ModelConfig API 클라이언트 (kind=chat|embedding|rerank).
 * 백엔드 `/api/model-configs?kind=` 단일 엔드포인트를 호출한다.
 * (구 `/api/llm-configs`·`/api/rerank-configs` 는 PR4 까지 deprecation alias.)
 */
export type ModelConfigKind = "chat" | "embedding" | "rerank";

export const MODEL_CONFIGS_QUERY_KEY = ["model-configs"] as const;

/**
 * Factory for the kind-scoped list query key.
 * Callers that need to `invalidateQueries` a specific kind can use this instead
 * of the individual `MODEL_CONFIGS_*_LIST_QUERY_KEY` constants.
 * e.g. `queryClient.invalidateQueries({ queryKey: makeModelConfigsListKey("chat") })`
 */
export const makeModelConfigsListKey = (kind: ModelConfigKind) =>
  ["model-configs", kind, "list"] as const;

/** Shared query key for the kind=embedding ModelConfig list used across KB create/edit + default hook. */
export const MODEL_CONFIGS_EMBEDDING_LIST_QUERY_KEY = [
  "model-configs",
  "embedding",
  "list",
] as const;

/**
 * Shared query key for the kind=chat ModelConfig list. Used by the canvas
 * pre-fill, the llm-config selector dropdown, and the default-config hook so
 * a single fetch is reused via the query cache. (구 `LLM_CONFIGS_QUERY_KEY`
 * 대체 — PR4 에서 `/llm-configs` alias 제거.)
 */
export const MODEL_CONFIGS_CHAT_LIST_QUERY_KEY = [
  "model-configs",
  "chat",
  "list",
] as const;

/**
 * Shared query key for the kind=rerank ModelConfig list used by the KB rerank
 * selector across create/edit. (구 `RERANK_CONFIGS_QUERY_KEY` 대체 — PR4 에서
 * `/rerank-configs` alias 제거.)
 */
export const MODEL_CONFIGS_RERANK_LIST_QUERY_KEY = [
  "model-configs",
  "rerank",
  "list",
] as const;

export interface ModelConfigData {
  id: string;
  kind: ModelConfigKind;
  provider: string;
  name: string;
  apiKey: string | null; // masked; null = 자가호스팅 키 미설정
  baseUrl?: string | null;
  defaultModel: string;
  defaultParams?: Record<string, unknown>; // chat 전용
  dimension?: number | null; // embedding 전용
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ModelInfo {
  id: string;
  name: string;
  type: "chat" | "embedding";
}

export interface CreateModelConfigPayload {
  kind: ModelConfigKind;
  provider: string;
  name: string;
  apiKey?: string;
  baseUrl?: string;
  defaultModel: string;
  defaultParams?: Record<string, unknown>;
  dimension?: number;
  isDefault?: boolean;
}

export type UpdateModelConfigPayload = Partial<
  Omit<CreateModelConfigPayload, "kind">
>;

export const modelConfigsApi = {
  async getAll(
    kind: ModelConfigKind,
    params?: { page?: number; limit?: number; search?: string },
  ) {
    const { data } = await apiClient.get("/model-configs", {
      params: { kind, ...params },
    });
    return data;
  },

  /**
   * kind 별 전체 목록을 flat 배열로 반환 (selector 드롭다운·KB 임베딩 select 용).
   * 페이지네이션 `getAll` 과 React Query 캐시 키가 겹치지 않도록 직접 호출한다
   * (llm-configs.ts list() 와 동일한 cache-collision 방지 패턴).
   */
  async list(kind: ModelConfigKind): Promise<ModelConfigData[]> {
    const { data: raw } = await apiClient.get("/model-configs", {
      // limit 은 PaginationQueryDto 의 @Max(100) 상한을 넘으면 400(VALIDATION_ERROR)
      // 이 되므로 상한값을 사용한다. 워크스페이스당 kind 별 모델 설정은 관리자
      // 큐레이션 항목이라 100 개를 넘지 않는다.
      params: { kind, limit: 100 },
    });
    const enveloped = (raw as { data?: ModelConfigData[] } | undefined)?.data;
    if (Array.isArray(enveloped)) return enveloped;
    if (Array.isArray(raw)) return raw as ModelConfigData[];
    return [];
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/model-configs/${id}`);
    return data;
  },

  async create(payload: CreateModelConfigPayload) {
    const { data } = await apiClient.post("/model-configs", payload);
    return data;
  },

  async update(id: string, payload: UpdateModelConfigPayload) {
    const { data } = await apiClient.patch(`/model-configs/${id}`, payload);
    return data;
  },

  async setDefault(id: string) {
    await apiClient.patch(`/model-configs/${id}/set-default`);
  },

  async testConnection(id: string) {
    const response = await apiClient.post(`/model-configs/${id}/test`);
    return unwrap<{ success: boolean; latencyMs?: number; message?: string | null }>(response);
  },

  async listModels(id: string, opts?: { type?: "chat" | "embedding" }) {
    const response = await apiClient.get(`/model-configs/${id}/models`, {
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
      "/model-configs/preview-models",
      payload,
    );
    return unwrap<ModelInfo[]>(response);
  },

  async remove(id: string) {
    await apiClient.delete(`/model-configs/${id}`);
  },
};
