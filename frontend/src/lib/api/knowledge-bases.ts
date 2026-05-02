import { apiClient } from "./client";

export type RagMode = "vector" | "graph";

export interface KnowledgeBaseData {
  id: string;
  name: string;
  description?: string;
  embeddingModel: string;
  embeddingDimension?: number | null;
  chunkSize: number;
  chunkOverlap: number;
  documentCount: number;
  ragMode: RagMode;
  extractionLlmConfigId?: string | null;
  maxHops: number;
  vectorSeedTopK: number;
  expandedChunkLimit: number;
  entityCount: number;
  relationCount: number;
  reembedStatus: "idle" | "in_progress";
  reextractStatus: "idle" | "in_progress";
  createdAt: string;
  updatedAt: string;
}

export interface DocumentData {
  id: string;
  knowledgeBaseId: string;
  name: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  embeddingStatus: "pending" | "processing" | "completed" | "error";
  graphExtractionStatus: "pending" | "processing" | "completed" | "error";
  chunkCount: number;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface KbGraphStats {
  entityCount: number;
  relationCount: number;
  extractedDocumentCount: number;
  totalDocumentCount: number;
  reextractStatus: "idle" | "in_progress";
}

export type EntityType =
  | "person"
  | "organization"
  | "concept"
  | "location"
  | "event"
  | "other";

export interface GraphEntity {
  id: string;
  name: string;
  displayName: string;
  type: EntityType;
  description?: string | null;
  mentionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface EntityChunkPreview {
  chunkId: string;
  documentId: string;
  documentName: string;
  contentPreview: string;
}

export interface GraphEntityDetail extends GraphEntity {
  mentionedInChunks: EntityChunkPreview[];
}

export interface GraphRelation {
  id: string;
  predicate: string;
  weight: number;
  headEntity: GraphEntity | null;
  tailEntity: GraphEntity | null;
  createdAt: string;
  updatedAt: string;
}

export interface GraphVizNode {
  id: string;
  label: string;
  type: EntityType;
  mentionCount: number;
}

export interface GraphVizEdge {
  id: string;
  source: string;
  target: string;
  predicate: string;
  weight: number;
}

export interface GraphVisualizationData {
  nodes: GraphVizNode[];
  edges: GraphVizEdge[];
  truncated: boolean;
}

export const knowledgeBasesApi = {
  async getAll(params?: { page?: number; limit?: number; search?: string }) {
    const { data } = await apiClient.get("/knowledge-bases", { params });
    return data;
  },

  async getById(id: string) {
    const { data } = await apiClient.get(`/knowledge-bases/${id}`);
    return data;
  },

  async create(payload: {
    name: string;
    description?: string;
    embeddingModel?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    ragMode?: RagMode;
    extractionLlmConfigId?: string;
    maxHops?: number;
    vectorSeedTopK?: number;
    expandedChunkLimit?: number;
  }) {
    const { data } = await apiClient.post("/knowledge-bases", payload);
    return data;
  },

  async update(
    id: string,
    payload: Partial<{
      name: string;
      description: string;
      embeddingModel: string;
      chunkSize: number;
      chunkOverlap: number;
      extractionLlmConfigId: string;
      maxHops: number;
      vectorSeedTopK: number;
      expandedChunkLimit: number;
    }>,
  ) {
    const { data } = await apiClient.patch(`/knowledge-bases/${id}`, payload);
    return data;
  },

  async reEmbedAll(
    kbId: string,
  ): Promise<{ message: string; documentCount: number }> {
    const { data } = await apiClient.post(`/knowledge-bases/${kbId}/re-embed`);
    // 백엔드 응답이 `{ data: ... }` 봉투형/평형 양쪽으로 올 수 있어 둘 다 unwrap.
    const body = (data as { data?: unknown })?.data ?? data;
    return body as { message: string; documentCount: number };
  },

  async remove(id: string) {
    await apiClient.delete(`/knowledge-bases/${id}`);
  },

  // Documents
  async getDocuments(kbId: string, params?: { page?: number; limit?: number }) {
    const { data } = await apiClient.get(`/knowledge-bases/${kbId}/documents`, {
      params,
    });
    return data;
  },

  async uploadDocument(kbId: string, file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await apiClient.post(
      `/knowledge-bases/${kbId}/documents`,
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    return data;
  },

  async removeDocument(kbId: string, docId: string) {
    await apiClient.delete(`/knowledge-bases/${kbId}/documents/${docId}`);
  },

  async reEmbed(kbId: string, docId: string) {
    const { data } = await apiClient.post(
      `/knowledge-bases/${kbId}/documents/${docId}/re-embed`,
    );
    return data;
  },

  // ── Graph RAG (graph 모드 KB 전용) ──
  async reExtractAll(
    kbId: string,
  ): Promise<{ message: string; documentCount: number }> {
    const { data } = await apiClient.post(
      `/knowledge-bases/${kbId}/re-extract`,
    );
    const body = (data as { data?: unknown })?.data ?? data;
    return body as { message: string; documentCount: number };
  },

  async reExtractDocument(kbId: string, docId: string) {
    const { data } = await apiClient.post(
      `/knowledge-bases/${kbId}/documents/${docId}/re-extract`,
    );
    return data;
  },

  async getGraphStats(kbId: string): Promise<KbGraphStats> {
    const { data } = await apiClient.get(
      `/knowledge-bases/${kbId}/graph/stats`,
    );
    const body = (data as { data?: unknown })?.data ?? data;
    return body as KbGraphStats;
  },

  async getEntities(
    kbId: string,
    params?: {
      page?: number;
      limit?: number;
      search?: string;
      type?: EntityType;
    },
  ) {
    const { data } = await apiClient.get(`/knowledge-bases/${kbId}/entities`, {
      params,
    });
    return data;
  },

  async getEntityDetail(kbId: string, entityId: string) {
    const { data } = await apiClient.get(
      `/knowledge-bases/${kbId}/entities/${entityId}`,
    );
    const body = (data as { data?: unknown })?.data ?? data;
    return body as GraphEntityDetail;
  },

  async deleteEntity(kbId: string, entityId: string) {
    await apiClient.delete(`/knowledge-bases/${kbId}/entities/${entityId}`);
  },

  async getRelations(
    kbId: string,
    params?: { page?: number; limit?: number; search?: string },
  ) {
    const { data } = await apiClient.get(`/knowledge-bases/${kbId}/relations`, {
      params,
    });
    return data;
  },

  async deleteRelation(kbId: string, relationId: string) {
    await apiClient.delete(`/knowledge-bases/${kbId}/relations/${relationId}`);
  },

  async getGraphVisualization(
    kbId: string,
    limit?: number,
  ): Promise<GraphVisualizationData> {
    const { data } = await apiClient.get(
      `/knowledge-bases/${kbId}/graph/visualization`,
      { params: limit ? { limit } : undefined },
    );
    const body = (data as { data?: unknown })?.data ?? data;
    return body as GraphVisualizationData;
  },
};
