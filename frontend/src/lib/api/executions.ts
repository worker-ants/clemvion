import { apiClient } from "./client";

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
}

export interface ExecutionData {
  id: string;
  workflowId: string;
  status: "pending" | "running" | "completed" | "failed" | "cancelled";
  inputData: Record<string, unknown>;
  outputData: Record<string, unknown> | null;
  error: { message?: string } | null;
  startedAt: string;
  finishedAt: string | null;
  durationMs: number | null;
  nodeExecutions: NodeExecutionData[];
}

export const executionsApi = {
  getById: (id: string) =>
    apiClient.get<ExecutionData>(`/executions/${id}`),
};
