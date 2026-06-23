import { apiClient } from "./client";
import { unwrap } from "./unwrap";

/**
 * 통계 도메인 typed API 카탈로그 (refactor m-2).
 *
 * `statistics/page.tsx` 의 `apiClient.get("/statistics/...", { params })` 직접
 * 호출을 한 곳으로 모은다. 응답 envelope(`{ data }`) 은 `unwrap<T>` 로 벗긴다 —
 * 페이지의 로컬 `extractData` 헬퍼(`res.data.data ?? res.data`)와 동치.
 * `/statistics/export` 만 blob 응답이라 별도 처리한다.
 * (`lib/api/executions.ts` 관례 답습.)
 */

/** /statistics/* 공통 쿼리 파라미터. period 외 workflowId·custom range 가 선택적으로 붙는다. */
export type StatisticsQueryParams = Record<
  string,
  string | number | undefined
>;

export interface StatsSummary {
  totalExecutions: number;
  successCount: number;
  failedCount: number;
  cancelledCount: number;
  successRate: number;
  avgDurationMs: number;
  totalExecutionsChangeRate?: number | null;
}

export interface ExecutionDataPoint {
  date: string;
  total: number;
  completed: number;
  failed: number;
  cancelled: number;
}

export interface ErrorEntry {
  workflowId: string;
  workflowName: string;
  errorCount: number;
  lastErrorAt: string;
}

export interface TopWorkflow {
  workflowId: string;
  workflowName: string;
  executionCount: number;
  successRate: number;
  avgDurationMs: number;
}

export interface NodeStat {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  executionCount: number;
  avgDurationMs: number;
  errorRate: number;
}

export interface LlmUsageByModel {
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costUsd: number | null;
}

export interface LlmUsageSummaryResponse {
  totalPromptTokens: number;
  totalCompletionTokens: number;
  totalTokens: number;
  totalCostUsd: number | null;
  topProvider: string | null;
  byModel: LlmUsageByModel[];
}

export const statisticsApi = {
  /** `GET /statistics/summary` — 요약 카드 지표. */
  getSummary: async (
    params: StatisticsQueryParams,
  ): Promise<StatsSummary> => {
    const res = await apiClient.get("/statistics/summary", { params });
    return unwrap<StatsSummary>(res);
  },

  /** `GET /statistics/executions` — 기간별 실행 데이터 포인트. */
  getExecutions: async (
    params: StatisticsQueryParams,
  ): Promise<ExecutionDataPoint[]> => {
    const res = await apiClient.get("/statistics/executions", { params });
    return unwrap<ExecutionDataPoint[]>(res);
  },

  /** `GET /statistics/errors` — 워크플로별 에러 분포. */
  getErrors: async (
    params: StatisticsQueryParams,
  ): Promise<ErrorEntry[]> => {
    const res = await apiClient.get("/statistics/errors", { params });
    return unwrap<ErrorEntry[]>(res);
  },

  /** `GET /statistics/top-workflows` — 실행 횟수 상위 워크플로. */
  getTopWorkflows: async (
    params: StatisticsQueryParams,
  ): Promise<TopWorkflow[]> => {
    const res = await apiClient.get("/statistics/top-workflows", { params });
    return unwrap<TopWorkflow[]>(res);
  },

  /** `GET /statistics/node-stats` — 선택 워크플로의 노드별 성능. */
  getNodeStats: async (
    params: StatisticsQueryParams,
  ): Promise<NodeStat[]> => {
    const res = await apiClient.get("/statistics/node-stats", { params });
    return unwrap<NodeStat[]>(res);
  },

  /** `GET /statistics/llm-usage/summary` — LLM 토큰/비용 요약. */
  getLlmUsageSummary: async (
    params: StatisticsQueryParams,
  ): Promise<LlmUsageSummaryResponse> => {
    const res = await apiClient.get("/statistics/llm-usage/summary", {
      params,
    });
    return unwrap<LlmUsageSummaryResponse>(res);
  },

  /**
   * `GET /statistics/export` — CSV/JSON export. blob 응답이라 envelope 언래핑을
   * 하지 않고 `Blob` 으로 감싸 돌려준다. 다운로드(createObjectURL/anchor)는 호출부.
   */
  exportStats: async (params: StatisticsQueryParams): Promise<Blob> => {
    const res = await apiClient.get("/statistics/export", {
      params,
      responseType: "blob",
    });
    return new Blob([res.data as BlobPart]);
  },
};
