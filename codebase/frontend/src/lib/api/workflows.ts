import { apiClient } from "./client";

export interface WorkflowData {
  id: string;
  name: string;
  description?: string;
  isActive: boolean;
  tags: string[];
  settings: Record<string, unknown>;
  currentVersion: number;
}

export interface NodeData {
  id: string;
  workflowId: string;
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
  isDisabled: boolean;
  description?: string;
  containerId?: string;
}

export interface EdgeData {
  id: string;
  workflowId: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  type: string;
}

export interface ExportedNode {
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
  isDisabled: boolean;
  description?: string;
  containerIndex: number | null;
  toolOwnerIndex: number | null;
}

export interface ExportedEdge {
  sourceNodeIndex: number;
  sourcePort: string;
  targetNodeIndex: number;
  targetPort: string;
  type: string;
  condition: Record<string, unknown> | null;
}

export interface ExportedWorkflow {
  name: string;
  description?: string;
  tags: string[];
  settings: Record<string, unknown>;
  nodes: ExportedNode[];
  edges: ExportedEdge[];
}

export interface VersionSnapshotNode {
  id: string;
  type: string;
  category: string;
  label: string;
  positionX: number;
  positionY: number;
  config: Record<string, unknown>;
  isDisabled: boolean;
  description: string | null;
  containerId: string | null;
  toolOwnerId: string | null;
}

export interface VersionSnapshotEdge {
  id: string;
  sourceNodeId: string;
  sourcePort: string;
  targetNodeId: string;
  targetPort: string;
  type: string;
  condition: Record<string, unknown> | null;
}

export interface VersionSnapshot {
  name: string;
  description: string | null;
  nodes: VersionSnapshotNode[];
  edges: VersionSnapshotEdge[];
}

export interface WorkflowVersionSummary {
  id: string;
  workflowId: string;
  version: number;
  changeSummary: string | null;
  createdBy: string;
  createdAt: string;
  creator?: { id: string; name?: string; email?: string } | null;
}

export interface WorkflowVersionDetail extends WorkflowVersionSummary {
  snapshot: VersionSnapshot;
}

export const workflowsApi = {
  list: (params?: Record<string, string>) =>
    apiClient.get("/workflows", { params }),

  get: (id: string) => apiClient.get<{ data: WorkflowData }>(`/workflows/${id}`),

  create: (data: { name: string; description?: string }) =>
    apiClient.post<{ data: WorkflowData }>("/workflows", data),

  update: (id: string, data: Partial<WorkflowData>) =>
    apiClient.patch<{ data: WorkflowData }>(`/workflows/${id}`, data),

  delete: (id: string) => apiClient.delete(`/workflows/${id}`),

  duplicate: (id: string) =>
    apiClient.post<{ data: WorkflowData }>(`/workflows/${id}/duplicate`),

  getNodes: (workflowId: string) =>
    apiClient.get<{ data: NodeData[] }>(`/workflows/${workflowId}/nodes`),

  createNode: (workflowId: string, data: Partial<NodeData>) =>
    apiClient.post<{ data: NodeData }>(`/workflows/${workflowId}/nodes`, data),

  updateNode: (nodeId: string, data: Partial<NodeData>) =>
    apiClient.patch<{ data: NodeData }>(`/nodes/${nodeId}`, data),

  deleteNode: (nodeId: string) => apiClient.delete(`/nodes/${nodeId}`),

  getEdges: (workflowId: string) =>
    apiClient.get<{ data: EdgeData[] }>(`/workflows/${workflowId}/edges`),

  createEdge: (workflowId: string, data: Partial<EdgeData>) =>
    apiClient.post<{ data: EdgeData }>(`/workflows/${workflowId}/edges`, data),

  deleteEdge: (edgeId: string) => apiClient.delete(`/edges/${edgeId}`),

  saveCanvas: (
    workflowId: string,
    data: {
      name?: string;
      nodes: Array<{
        id: string;
        type: string;
        category: string;
        label: string;
        positionX: number;
        positionY: number;
        config?: Record<string, unknown>;
        isDisabled?: boolean;
        containerId?: string | null;
        toolOwnerId?: string | null;
      }>;
      edges: Array<{
        sourceNodeId: string;
        sourcePort?: string;
        targetNodeId: string;
        targetPort?: string;
        type?: string;
      }>;
    },
  ) => apiClient.post(`/workflows/${workflowId}/save`, data),

  execute: (
    workflowId: string,
    options?: {
      input?: Record<string, unknown>;
      parameterValues?: Record<string, unknown>;
    },
  ) =>
    apiClient.post(`/workflows/${workflowId}/execute`, {
      input: options?.input,
      parameterValues: options?.parameterValues,
    }),

  /**
   * parallel-p2 결정 D + E + I (2026-05-30) — cross-node graphWarningRules
   * 의 frontend canvas 사전 평가. graph 변경 시점에 호출하여 results /
   * hasError / hasWarning 받음. severity error 가 하나라도 있으면 canvas 가
   * 저장 버튼 disable + 노드 배지. SoT: spec/conventions/cross-node-warning-rules.md.
   */
  graphWarnings: (workflowId: string) =>
    apiClient.get<{
      results: Array<{
        ruleId: string;
        severity: "error" | "warning";
        nodeId: string;
        message: string;
      }>;
      hasError: boolean;
      hasWarning: boolean;
    }>(`/workflows/${workflowId}/graph-warnings`),

  exportWorkflow: (id: string) =>
    apiClient.get<{ data: ExportedWorkflow }>(`/workflows/${id}/export`),

  importWorkflow: (data: object) =>
    apiClient.post<{ data: WorkflowData }>("/workflows/import", data),

  listVersions: (workflowId: string) =>
    apiClient.get<{ data: WorkflowVersionSummary[] }>(
      `/workflows/${workflowId}/versions`,
    ),

  getVersion: (workflowId: string, versionId: string) =>
    apiClient.get<{ data: WorkflowVersionDetail }>(
      `/workflows/${workflowId}/versions/${versionId}`,
    ),

  restoreVersion: (workflowId: string, versionId: string) =>
    apiClient.post<{
      data: { workflow: WorkflowData; nodes: NodeData[]; edges: EdgeData[] };
    }>(`/workflows/${workflowId}/versions/${versionId}/restore`),
};
