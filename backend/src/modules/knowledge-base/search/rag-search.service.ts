import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LlmService } from '../../llm/llm.service';
import { SearchResult, RagContext } from './search-result.interface';

// V021 마이그레이션이 만들어 둔 partial HNSW 인덱스가 존재하는 차원만 허용한다.
// 새 차원 모델을 도입할 때는 신규 마이그레이션 + 여기 SUPPORTED_DIMS 에 추가하는 것이 한 쌍.
const SUPPORTED_DIMS = new Set([768, 1536, 3072]);

interface KbRow {
  id: string;
  embeddingModel: string;
  embeddingDimension: number | null;
}

type RawSearchRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: string;
  metadata: Record<string, unknown>;
};

@Injectable()
export class RagSearchService {
  private readonly logger = new Logger(RagSearchService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly llmService: LlmService,
  ) {}

  async search(
    query: string,
    knowledgeBaseIds: string[],
    workspaceId: string,
    options?: { topK?: number; threshold?: number },
  ): Promise<SearchResult[]> {
    if (!knowledgeBaseIds?.length || !query.trim()) {
      return [];
    }

    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0.7;

    try {
      // KB 메타데이터(embeddingModel, embeddingDimension)를 한 번에 로드
      const kbs = await this.dataSource.query<KbRow[]>(
        `SELECT id, embedding_model AS "embeddingModel", embedding_dimension AS "embeddingDimension"
         FROM knowledge_base
         WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
        [knowledgeBaseIds, workspaceId],
      );

      if (kbs.length === 0) {
        return [];
      }

      // (model, dim) 조합으로 그룹핑 — 같은 그룹은 query 임베딩을 한 번만 계산하고
      // 한 번의 SQL 로 처리한다 (spec 9-rag-search.md §6).
      const groups = new Map<
        string,
        { model: string; dim: number; kbIds: string[] }
      >();
      for (const kb of kbs) {
        if (kb.embeddingDimension == null) {
          // 아직 한 번도 임베딩이 안 된 KB 는 검색 대상에서 제외 (검색 결과 0건과 동일하게 처리)
          continue;
        }
        if (!SUPPORTED_DIMS.has(kb.embeddingDimension)) {
          this.logger.warn(
            `Skipping KB ${kb.id}: dimension ${kb.embeddingDimension} has no partial HNSW index`,
          );
          continue;
        }
        const key = `${kb.embeddingModel}::${kb.embeddingDimension}`;
        const existing = groups.get(key);
        if (existing) {
          existing.kbIds.push(kb.id);
        } else {
          groups.set(key, {
            model: kb.embeddingModel,
            dim: kb.embeddingDimension,
            kbIds: [kb.id],
          });
        }
      }

      if (groups.size === 0) {
        return [];
      }

      const llmConfig = await this.llmService.resolveConfig(
        undefined,
        workspaceId,
      );

      const merged: SearchResult[] = [];
      for (const { model, dim, kbIds } of groups.values()) {
        const embeddings = await this.llmService.embed(
          llmConfig,
          [query],
          model,
        );
        const queryEmbedding = embeddings[0];
        if (!queryEmbedding || queryEmbedding.length !== dim) {
          this.logger.warn(
            `Skipping group model=${model} dim=${dim}: returned embedding has unexpected dimension ${queryEmbedding?.length}`,
          );
          continue;
        }
        const vectorStr = `[${queryEmbedding.join(',')}]`;

        // partial HNSW 인덱스를 타려면 인덱스 정의와 동일한 cast 표현식 + 차원 조건이 필요.
        // dim 은 SUPPORTED_DIMS 화이트리스트 통과 직후라 SQL 인라인이 안전하다.
        const rows = await this.dataSource.query<RawSearchRow[]>(
          `SELECT
            dc.id AS "chunkId",
            dc.document_id AS "documentId",
            d.name AS "documentName",
            dc.content,
            dc.metadata,
            1 - (dc.embedding::vector(${dim}) <=> $1::vector(${dim})) AS score
          FROM document_chunk dc
          JOIN document d ON d.id = dc.document_id
          JOIN knowledge_base kb ON kb.id = d.knowledge_base_id AND kb.workspace_id = $5
          WHERE vector_dims(dc.embedding) = ${dim}
            AND d.knowledge_base_id = ANY($2::uuid[])
            AND d.embedding_status = 'completed'
            AND dc.embedding IS NOT NULL
            AND 1 - (dc.embedding::vector(${dim}) <=> $1::vector(${dim})) >= $3
          ORDER BY score DESC
          LIMIT $4`,
          [vectorStr, kbIds, threshold, topK, workspaceId],
        );

        for (const r of rows) {
          merged.push({
            chunkId: r.chunkId,
            documentId: r.documentId,
            documentName: r.documentName,
            content: r.content,
            score: parseFloat(r.score),
            metadata: r.metadata || {},
          });
        }
      }

      // 그룹 결과를 score 내림차순으로 통합 후 topK 슬라이스
      merged.sort((a, b) => b.score - a.score);
      return merged.slice(0, topK);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`RAG search failed: ${message}`);
      return [];
    }
  }

  buildContext(results: SearchResult[]): RagContext {
    if (results.length === 0) {
      return { context: '', sources: [] };
    }

    const lines = results.map(
      (r) =>
        `---\n[Source: ${r.documentName}] (relevance: ${r.score.toFixed(2)})\n${r.content}\n`,
    );

    const context = `\n### Relevant Knowledge\n\nThe following information was retrieved from the knowledge base. Use it to inform your response when relevant.\n\n${lines.join('\n')}---`;

    return {
      context,
      sources: results.map((r) => ({
        ...r,
        content:
          r.content.substring(0, 200) + (r.content.length > 200 ? '...' : ''),
      })),
    };
  }
}
