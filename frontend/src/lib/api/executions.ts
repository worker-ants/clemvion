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
  status: "pending" | "running" | "completed" | "failed" | "skipped" | "waiting_for_input";
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
  nodeExecutions: NodeExecutionData[];
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

export const executionsApi = {
  getById: async (id: string): Promise<ExecutionData> => {
    const { data } = await apiClient.get(`/executions/${id}`);
    return unwrap<ExecutionData>(data);
  },

  getByWorkflow: async (
    workflowId: string,
    params?: ExecutionListParams,
  ): Promise<PaginatedExecutions> => {
    const { data } = await apiClient.get(`/executions/workflow/${workflowId}`, { params });
    return data as PaginatedExecutions;
  },
};
