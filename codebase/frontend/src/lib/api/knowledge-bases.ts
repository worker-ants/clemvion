import { apiClient } from "./client";
import { unwrap } from "./unwrap";

export type RagMode = "vector" | "graph";

export type RerankMode = "off" | "cross_encoder" | "cross_encoder_llm";

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
  embeddingLlmConfigId?: string | null;
  maxHops: number;
  vectorSeedTopK: number;
  expandedChunkLimit: number;
  rerankMode: RerankMode;
  rerankConfigId?: string | null;
  rerankCandidateK: number;
  rerankScoreThreshold?: number | null;
  rerankLlmConfigId?: string | null;
  entityCount: number;
  relationCount: number;
  reembedStatus: "idle" | "in_progress";
  reextractStatus: "idle" | "in_progress";
  createdAt: string;
  updatedAt: string;
}

// 'error' = in-flight 재시도 중 일시 오류, 'failed' = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패
export type DocumentEmbeddingStatus =
  | "pending"
  | "processing"
  | "completed"
  | "error"
  | "failed";

export type DocumentGraphExtractionStatus = DocumentEmbeddingStatus;

export interface DocumentData {
  id: string;
  knowledgeBaseId: string;
  name: string;
  fileType: string;
  fileUrl: string;
  fileSize: number;
  embeddingStatus: DocumentEmbeddingStatus;
  embeddingRetryCount?: number;
  embeddingLastAttemptedAt?: string | null;
  embeddingErrorMessage?: string | null;
  graphExtractionStatus: DocumentGraphExtractionStatus | null;
  graphRetryCount?: number;
  graphLastAttemptedAt?: string | null;
  graphErrorMessage?: string | null;
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
  failedDocumentCount: number;
  pendingDocumentCount: number;
  totalDocumentCount: number;
  reextractStatus: "idle" | "in_progress";
}

export interface KbEmbeddingStats {
  completedDocumentCount: number;
  failedDocumentCount: number;
  pendingDocumentCount: number;
  totalDocumentCount: number;
  reembedStatus: "idle" | "in_progress";
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
  truncated: boolean;
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
    embeddingLlmConfigId?: string;
    chunkSize?: number;
    chunkOverlap?: number;
    ragMode?: RagMode;
    extractionLlmConfigId?: string;
    maxHops?: number;
    vectorSeedTopK?: number;
    expandedChunkLimit?: number;
    rerankMode?: RerankMode;
    rerankConfigId?: string;
    rerankCandidateK?: number;
    rerankScoreThreshold?: number;
    rerankLlmConfigId?: string;
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
      embeddingLlmConfigId: string | null;
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

  async probeEmbedding(payload: {
    llmConfigId?: string;
    embeddingModel: string;
  }): Promise<{ dimension: number; provider: string }> {
    const response = await apiClient.post(
      "/knowledge-bases/embedding-probe",
      payload,
    );
    return unwrap<{ dimension: number; provider: string }>(response);
  },

  async reEmbedAll(kbId: string): Promise<{
    message: string;
    documentCount: number;
    chainedGraphExtraction: boolean;
  }> {
    const response = await apiClient.post(`/knowledge-bases/${kbId}/re-embed`);
    return unwrap<{
      message: string;
      documentCount: number;
      chainedGraphExtraction: boolean;
    }>(response);
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
    const response = await apiClient.post(
      `/knowledge-bases/${kbId}/re-extract`,
    );
    return unwrap<{ message: string; documentCount: number }>(response);
  },

  async reExtractDocument(kbId: string, docId: string) {
    const { data } = await apiClient.post(
      `/knowledge-bases/${kbId}/documents/${docId}/re-extract`,
    );
    return data;
  },

  async getGraphStats(kbId: string): Promise<KbGraphStats> {
    const response = await apiClient.get(
      `/knowledge-bases/${kbId}/graph/stats`,
    );
    return unwrap<KbGraphStats>(response);
  },

  async getEmbeddingStats(kbId: string): Promise<KbEmbeddingStats> {
    const response = await apiClient.get(
      `/knowledge-bases/${kbId}/embedding-stats`,
    );
    return unwrap<KbEmbeddingStats>(response);
  },

  async retryFailed(
    kbId: string,
    scope: "embedding" | "graph" | "all" = "all",
  ): Promise<{
    message: string;
    embeddingRequeued: number;
    graphRequeued: number;
  }> {
    const response = await apiClient.post(
      `/knowledge-bases/${kbId}/retry-failed`,
      { scope },
    );
    return unwrap<{
      message: string;
      embeddingRequeued: number;
      graphRequeued: number;
    }>(response);
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
    const response = await apiClient.get(
      `/knowledge-bases/${kbId}/entities/${entityId}`,
    );
    return unwrap<GraphEntityDetail>(response);
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
    const response = await apiClient.get(
      `/knowledge-bases/${kbId}/graph/visualization`,
      { params: limit ? { limit } : undefined },
    );
    return unwrap<GraphVisualizationData>(response);
  },
};
