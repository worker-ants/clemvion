import { apiClient } from "./client";

export type ExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "waiting_for_input";

export interface NodeExecutionData {
  id: string;
  executionId: string;
  nodeId: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "cancelled"
    | "skipped"
    | "waiting_for_input";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  error: { message?: string } | null;
  retryCount: number;
  /**
   * NodeExecution.id of the Sub-Workflow node that invoked this node via
   * inline execution. Null for nodes in the root workflow. Used by the
   * run-results timeline to render Sub-Workflow children as a nested card.
   */
  parentNodeExecutionId: string | null;
  node?: { id: string; type: string; label: string };
}

export const EXECUTION_TRIGGER_SOURCES = [
  "manual",
  "schedule",
  "webhook",
  "subworkflow",
  "unknown",
] as const;

export type ExecutionTriggerSource = (typeof EXECUTION_TRIGGER_SOURCES)[number];

export interface ExecutionData {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  error: { message?: string } | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  triggerSource: ExecutionTriggerSource;
  triggerLabel: string | null;
  nodeExecutions: NodeExecutionData[];
  /**
   * Re-run chain 메타 (spec/5-system/13-replay-rerun.md §8.2). 백엔드
   * `ExecutionDto` 가 GET 상세 / chain 항목 / list 모두에서 노출한다.
   * - `reRunOf`: 직전 원본 실행 ID. re-run 이 아니면 null.
   * - `chainId`: 같은 chain 의 root 실행 ID. re-run 이 아니면 null.
   * - `dryRun`: dry-run 모드로 생성된 실행이면 true.
   */
  reRunOf?: string | null;
  chainId?: string | null;
  dryRun?: boolean;
  /**
   * 원본 실행 시작자 (user id). 트리거/스케줄/웹훅 자동 실행은 null.
   * Re-run 권한 판정 (RR-PL-06) 에 사용 — `lib/executions/can-rerun.ts`.
   */
  executedBy?: string | null;
}

export interface ExecutionListParams {
  page?: number;
  limit?: number;
  sort?: "started_at" | "finished_at" | "status" | "duration_ms";
  order?: "asc" | "desc";
  status?: ExecutionStatus;
}

export interface PaginatedExecutions {
  data: ExecutionData[];
  pagination: {
    page: number;
    limit: number;
    totalItems: number;
    totalPages: number;
  };
}

// Helper to unwrap API response that may be wrapped in { data: T }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function unwrap<T>(data: any): T {
  return data?.data != null && typeof data.data === "object" && !Array.isArray(data.data)
    ? data.data
    : data;
}

// ---------------------------------------------------------------------------
// Re-run (spec/5-system/13-replay-rerun.md §8.1 / §8.2)
// ---------------------------------------------------------------------------

/**
 * `POST /executions/:id/re-run` 요청 body.
 * - `useOriginalInput` (default true): 원본 실행의 입력을 그대로 사용.
 * - `inputOverride`: 사용자가 편집한 입력으로 대체 (useOriginalInput=false 일 때).
 * - `dryRun` (default false): 외부 호출을 skip 하는 dry-run 모드.
 */
export interface ReRunRequest {
  useOriginalInput?: boolean;
  inputOverride?: Record<string, unknown>;
  dryRun?: boolean;
}

/**
 * Re-run 결과 — 새로 생성된 Execution 상세 ({@link ExecutionData}) 에
 * chain 메타(`reRunOf` / `chainId` / `dryRun`)가 추가된 형태.
 */
export interface ReRunResult extends ExecutionData {
  /** 원본(직전) 실행 ID. */
  reRunOf: string;
  /** 같은 re-run chain 의 root 실행 ID. */
  chainId: string;
  /** dry-run 모드 여부. */
  dryRun: boolean;
}

/**
 * `GET /executions/:id/chain` 의 항목 — execution 요약 (nodeExecutions 생략).
 * 백엔드 `ExecutionDto` 를 미러링한다
 * (codebase/backend/.../dto/responses/execution-response.dto.ts).
 */
export interface ExecutionChainItem {
  id: string;
  workflowId: string;
  status: ExecutionStatus;
  triggerSource: ExecutionTriggerSource;
  triggerLabel: string | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  inputData?: Record<string, unknown> | null;
  outputData?: Record<string, unknown> | null;
  error?: Record<string, unknown> | null;
  executedBy?: string | null;
  parentExecutionId?: string | null;
  recursionDepth: number;
  executionPath: string[];
  /** 직전 원본 실행 ID. chain root(원본)이면 null. */
  reRunOf?: string | null;
  /** 같은 re-run chain 의 root 실행 ID. */
  chainId?: string | null;
  /** dry-run 모드로 생성된 실행이면 true. */
  dryRun?: boolean;
}

export const executionsApi = {
  getById: async (id: string): Promise<ExecutionData> => {
    const { data } = await apiClient.get(`/executions/${id}`);
    return unwrap<ExecutionData>(data);
  },

  /**
   * 실행 재실행 (Re-run). `POST /executions/:id/re-run`. 현재 시점 워크플로
   * 정의로 새 Execution 을 시작한다. 에러 코드(RERUN_PERMISSION_DENIED /
   * RERUN_CHAIN_DEPTH_EXCEEDED / RERUN_WORKFLOW_DELETED /
   * RERUN_DRY_RUN_NOT_APPLICABLE 등)는 axios 에러의 `response.data.code` 로
   * 노출된다.
   */
  reRun: async (id: string, body?: ReRunRequest): Promise<ReRunResult> => {
    const { data } = await apiClient.post(`/executions/${id}/re-run`, body ?? {});
    return unwrap<ReRunResult>(data);
  },

  /**
   * 같은 re-run chain 의 모든 실행을 started_at ASC 로 조회.
   * `GET /executions/:id/chain`. nodeExecutions 는 포함되지 않는다.
   */
  getChain: async (id: string): Promise<ExecutionChainItem[]> => {
    const { data } = await apiClient.get(`/executions/${id}/chain`);
    // `unwrap` only peels non-array `{ data: {...} }` envelopes; the chain is a
    // *list* wrapped as `{ data: [...] }`, so unwrap the array form explicitly.
    if (Array.isArray(data)) return data as ExecutionChainItem[];
    if (data && Array.isArray((data as { data?: unknown }).data)) {
      return (data as { data: ExecutionChainItem[] }).data;
    }
    return [];
  },

  getByWorkflow: async (
    workflowId: string,
    params?: ExecutionListParams,
  ): Promise<PaginatedExecutions> => {
    const { data } = await apiClient.get(`/executions/workflow/${workflowId}`, { params });
    return data as PaginatedExecutions;
  },

  /**
   * 실행 중단 (사용자 cancel 버튼 — spec/conventions/node-cancellation.md).
   * `POST /executions/:id/stop`. running / waiting_for_input / pending 상태에서
   * 호출 가능하며, 최종 `cancelled` 전이는 WS `execution.cancelled` 이벤트로
   * 확정된다 (REST 는 즉시 갱신된 entity 를 반환).
   */
  stop: async (id: string): Promise<ExecutionData> => {
    const { data } = await apiClient.post(`/executions/${id}/stop`);
    return unwrap<ExecutionData>(data);
  },
};

// ---------------------------------------------------------------------------
// Background run monitoring API
// spec/4-nodes/1-logic/12-background.md §8
// ---------------------------------------------------------------------------

/**
 * Background 본문 run 의 집계 상태. 백엔드에서 현재 4개 값만 발행 — 메인
 * Execution cancel 이 본문 run 으로 전파되는 흐름은 아직 없다 (spec §8.2).
 */
export type BackgroundRunStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed";

export interface BackgroundRunNodeExecution {
  id: string;
  executionId: string;
  nodeId: string;
  parentNodeExecutionId: string;
  status:
    | "pending"
    | "running"
    | "completed"
    | "failed"
    | "skipped"
    | "waiting_for_input";
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
}

export interface BackgroundRunNodeExecutionsPage {
  data: BackgroundRunNodeExecution[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface BackgroundRunNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  createdAt: string;
}

export interface BackgroundRunData {
  backgroundRunId: string;
  executionId: string;
  parentNodeExecutionId: string;
  status: BackgroundRunStatus;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  nodeExecutions: BackgroundRunNodeExecutionsPage;
  notifications: BackgroundRunNotification[];
}

export interface BackgroundRunQueryParams {
  cursor?: string;
  limit?: number;
}

export const backgroundRunsApi = {
  getById: async (
    executionId: string,
    backgroundRunId: string,
    params?: BackgroundRunQueryParams,
  ): Promise<BackgroundRunData> => {
    const { data } = await apiClient.get(
      `/executions/${executionId}/background-runs/${backgroundRunId}`,
      { params },
    );
    return unwrap<BackgroundRunData>(data);
  },
};
