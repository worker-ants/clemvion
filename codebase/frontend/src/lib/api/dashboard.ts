import { apiClient } from "./client";
import { unwrap } from "./unwrap";
import type { ExecutionTriggerSource } from "./executions";

/**
 * 대시보드 도메인 typed API 카탈로그 (refactor m-2).
 *
 * `dashboard/page.tsx` 의 `apiClient` 직접 호출(summary / recent-workflows /
 * recent-executions)을 한 곳으로 모은다. 응답 envelope(`{ data }`) 은
 * `unwrap<T>` 로 한 겹 벗긴다 — 페이지의 `data.data ?? data` 패턴과 동치.
 * (`lib/api/executions.ts` 관례 답습.)
 */

/** `GET /dashboard/summary` 응답 — 요약 카드 지표. */
export interface DashboardSummary {
  totalWorkflows: number;
  activeWorkflows: number;
  runs7d: number;
  runs7dPrevious: number;
  runs7dChangePercent: number | null;
  successRate: number;
  avgExecutionTime: number;
}

/** `GET /dashboard/recent-workflows` 항목. */
export interface RecentWorkflow {
  id: string;
  name: string;
  isActive: boolean;
  updatedAt: string;
}

/** `GET /dashboard/recent-executions` 항목 (백엔드가 LIMIT 10 으로 잘라 응답). */
export interface RecentExecution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: string;
  durationMs: number | null;
  startedAt: string;
  triggerSource: ExecutionTriggerSource;
  triggerLabel: string | null;
}

export const dashboardApi = {
  /** `GET /dashboard/summary` — 요약 카드 지표. */
  getSummary: async (): Promise<DashboardSummary> => {
    const res = await apiClient.get("/dashboard/summary");
    return unwrap<DashboardSummary>(res);
  },

  /** `GET /dashboard/recent-workflows` — 최근 워크플로 목록. */
  getRecentWorkflows: async (): Promise<RecentWorkflow[]> => {
    const res = await apiClient.get("/dashboard/recent-workflows");
    return unwrap<RecentWorkflow[]>(res);
  },

  /** `GET /dashboard/recent-executions` — 최근 실행 목록. */
  getRecentExecutions: async (): Promise<RecentExecution[]> => {
    const res = await apiClient.get("/dashboard/recent-executions");
    return unwrap<RecentExecution[]>(res);
  },
};
