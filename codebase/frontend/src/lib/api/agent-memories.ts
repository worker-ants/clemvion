import { apiClient } from "./client";
import {
  normalizePagedResponse,
  type PagedResult,
} from "./paginated";

// AI Agent persistent 메모리 관리 API (spec/2-navigation/16-agent-memory.md,
// spec/5-system/17-agent-memory.md §6). 응답은 모두 백엔드 표준
// PaginatedResponseDto<T> 이며 normalizePagedResponse 로 정규화한다.

export type MemoryKind = "fact" | "preference" | "entity";

export interface AgentMemoryScopeData {
  scopeKey: string;
  count: number;
  latestUpdatedAt: string;
}

export interface AgentMemoryData {
  id: string;
  content: string;
  // 백엔드가 향후 enum 외 값을 보낼 수 있어 string 도 허용 (열린 union).
  kind: MemoryKind | string;
  scopeKey: string;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
}

export interface ListScopesParams {
  limit: number;
  offset: number;
  q?: string;
}

export interface ListMemoriesParams {
  scopeKey: string;
  kind?: MemoryKind;
  limit: number;
  offset: number;
}

export const agentMemoriesApi = {
  async listScopes(
    params: ListScopesParams,
  ): Promise<PagedResult<AgentMemoryScopeData>> {
    const { q, ...rest } = params;
    const { data } = await apiClient.get("/agent-memories/scopes", {
      params: { ...rest, ...(q ? { q } : {}) },
    });
    return normalizePagedResponse<AgentMemoryScopeData>(data);
  },

  async listMemories(
    params: ListMemoriesParams,
  ): Promise<PagedResult<AgentMemoryData>> {
    const { kind, ...rest } = params;
    const { data } = await apiClient.get("/agent-memories", {
      params: { ...rest, ...(kind ? { kind } : {}) },
    });
    return normalizePagedResponse<AgentMemoryData>(data);
  },

  async remove(id: string): Promise<void> {
    await apiClient.delete(`/agent-memories/${id}`);
  },

  async clearScope(scopeKey: string): Promise<void> {
    await apiClient.delete("/agent-memories", { params: { scopeKey } });
  },
};
