import { apiClient } from "./client";
import { normalizePagedResponse, type PagedResult } from "./paginated";

/**
 * 스케줄 도메인 typed API 카탈로그 (refactor m-2).
 *
 * `schedules/page.tsx` 의 `apiClient` 직접 호출(list / create / update / toggle /
 * delete / run-now)을 한 곳으로 모은다. 페이지 응답은 `normalizePagedResponse`
 * 로 표준 `PagedResult` 로 정규화하며, 표시용 `Schedule` 매핑(mapSchedule)은
 * 뷰모델이라 페이지에 남긴다. (`lib/api/triggers.ts` 관례 답습.)
 */

/** `GET /schedules` 페이지 응답의 raw 행 — 페이지가 매핑하는 필드만. */
export interface RawSchedule {
  id: string;
  name?: string;
  cronExpression: string;
  timezone: string;
  isActive: boolean;
  nextRunAt?: string;
  parameterValues?: Record<string, unknown>;
  trigger?: {
    id?: string;
    name?: string;
    workflowId?: string;
    workflow?: { name?: string };
  };
}

/** `GET /schedules` 쿼리 파라미터 (list / calendar 두 변형 모두 수용). */
export interface ScheduleListParams {
  page: number;
  limit: number;
}

/** `POST /schedules` 생성 바디. */
export interface CreateScheduleBody {
  name: string;
  workflowId: string;
  cronExpression: string;
  timezone: string;
  parameterValues: Record<string, unknown>;
}

/** `PATCH /schedules/:id` 부분 수정 바디 (편집 전체 / isActive 토글 모두 수용). */
export interface UpdateScheduleBody {
  name?: string;
  cronExpression?: string;
  timezone?: string;
  parameterValues?: Record<string, unknown>;
  isActive?: boolean;
}

export const schedulesApi = {
  /** `GET /schedules` — 페이지네이션. 표준 `PagedResult<RawSchedule>` 로 정규화. */
  list: async (
    params: ScheduleListParams,
  ): Promise<PagedResult<RawSchedule>> => {
    const res = await apiClient.get("/schedules", { params });
    return normalizePagedResponse<RawSchedule>(res.data, params.page);
  },

  /** `POST /schedules` — 스케줄 생성. */
  create: async (body: CreateScheduleBody): Promise<void> => {
    await apiClient.post("/schedules", body);
  },

  /** `PATCH /schedules/:id` — 부분 수정 (편집 / isActive 토글 공용 경로). */
  update: async (id: string, body: UpdateScheduleBody): Promise<void> => {
    await apiClient.patch(`/schedules/${id}`, body);
  },

  /** `DELETE /schedules/:id` — 스케줄 삭제. */
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/schedules/${id}`);
  },

  /** `POST /schedules/:id/run-now` — 즉시 1회 실행. */
  runNow: async (id: string): Promise<void> => {
    await apiClient.post(`/schedules/${id}/run-now`);
  },
};
