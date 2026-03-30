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
};
