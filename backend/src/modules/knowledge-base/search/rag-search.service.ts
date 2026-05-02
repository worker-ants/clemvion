import { Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { LlmService } from '../../llm/llm.service';
import {
  SearchResult,
  RagContext,
  GraphTraversalSummary,
} from './search-result.interface';
import {
  SUPPORTED_EMBEDDING_DIMS,
  getEmbeddingCastType,
} from '../embedding/embedding-dimensions.const';

interface KbRow {
  id: string;
  embeddingModel: string;
  embeddingDimension: number | null;
  embeddingLlmConfigId: string | null;
  ragMode: 'vector' | 'graph';
  maxHops: number;
  vectorSeedTopK: number;
  expandedChunkLimit: number;
}

type RawSearchRow = {
  chunkId: string;
  documentId: string;
  documentName: string;
  content: string;
  score: string;
  metadata: Record<string, unknown>;
  origin?: string;
};

interface VectorGroup {
  model: string;
  dim: number;
  // KB 가 지정한 embeddingLlmConfigId. NULL 이면 워크스페이스 default 로 폴백.
  // (model, dim, embeddingLlmConfigId) 조합이 같아야 같은 그룹 — 같은 모델 이름이라도
  // LLMConfig endpoint 가 다르면 임베딩이 호환되지 않을 수 있으므로 분리한다.
  embeddingLlmConfigId: string | null;
  kbIds: string[];
}

interface GraphGroupResult {
  rows: SearchResult[];
  seedChunkCount: number;
  traversedEntityCount: number;
  expandedChunkCount: number;
  maxDepthUsed: number;
}

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
    const { results } = await this.searchWithMeta(
      query,
      knowledgeBaseIds,
      workspaceId,
      options,
    );
    return results;
  }

  // graph 모드 KB 가 검색에 한 번이라도 참여했다면 graphTraversal 메타를 함께 반환.
  // 호출부 (AI Agent 등) 가 응답 metadata 에 노출할 수 있다.
  async searchWithMeta(
    query: string,
    knowledgeBaseIds: string[],
    workspaceId: string,
    options?: { topK?: number; threshold?: number },
  ): Promise<{
    results: SearchResult[];
    graphTraversal?: GraphTraversalSummary;
  }> {
    if (!knowledgeBaseIds?.length || !query.trim()) {
      return { results: [] };
    }

    const topK = options?.topK ?? 5;
    const threshold = options?.threshold ?? 0.7;

    try {
      const kbs = await this.dataSource.query<KbRow[]>(
        `SELECT id,
                embedding_model AS "embeddingModel",
                embedding_dimension AS "embeddingDimension",
                embedding_llm_config_id AS "embeddingLlmConfigId",
                rag_mode AS "ragMode",
                max_hops AS "maxHops",
                vector_seed_top_k AS "vectorSeedTopK",
                expanded_chunk_limit AS "expandedChunkLimit"
         FROM knowledge_base
         WHERE id = ANY($1::uuid[]) AND workspace_id = $2`,
        [knowledgeBaseIds, workspaceId],
      );
      if (kbs.length === 0) return { results: [] };

      // KB 를 ragMode 로 분리: vector 는 (model, dim, llmConfig) 그룹화, graph 는 KB 단위 처리.
      // 각 그룹 / 각 graph KB 가 자체 embeddingLlmConfigId 를 resolveConfig 로 풀어 query 임베딩
      // 호출에 사용한다. 청크가 비-default LLMConfig 로 임베딩됐다면 query 도 같은 endpoint 로
      // 임베딩해야 유사도가 맞기 때문.
      const vectorKbs = kbs.filter((kb) => kb.ragMode === 'vector');
      const graphKbs = kbs.filter((kb) => kb.ragMode === 'graph');

      const vectorGroups = this.groupVectorKbs(vectorKbs);

      const vectorTasks = Array.from(vectorGroups.values()).map((g) =>
        this.searchVectorGroup(g, query, threshold, topK, workspaceId),
      );

      // graph KB 는 maxHops/seedTopK 가 KB 마다 다를 수 있어 KB 단위 분리 처리.
      const graphTasks = graphKbs
        .filter((kb) => this.isGraphKbSearchable(kb))
        .map((kb) => this.searchGraphKb(kb, query, threshold, workspaceId));

      const [vectorResults, graphResultsRaw] = await Promise.all([
        Promise.all(vectorTasks),
        Promise.all(graphTasks),
      ]);

      const merged: SearchResult[] = [
        ...vectorResults.flat(),
        ...graphResultsRaw.flatMap((g) => g.rows),
      ];
      merged.sort((a, b) => b.score - a.score);
      const sliced = merged.slice(0, topK);

      let graphTraversal: GraphTraversalSummary | undefined;
      if (graphResultsRaw.length > 0) {
        graphTraversal = {
          mode: 'graph',
          seedChunkCount: graphResultsRaw.reduce(
            (acc, g) => acc + g.seedChunkCount,
            0,
          ),
          traversedEntityCount: graphResultsRaw.reduce(
            (acc, g) => acc + g.traversedEntityCount,
            0,
          ),
          maxDepth: graphResultsRaw.reduce(
            (acc, g) => Math.max(acc, g.maxDepthUsed),
            0,
          ),
          expandedChunkCount: graphResultsRaw.reduce(
            (acc, g) => acc + g.expandedChunkCount,
            0,
          ),
        };
      }

      return { results: sliced, graphTraversal };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`RAG search failed: ${message}`);
      return { results: [] };
    }
  }

  private groupVectorKbs(kbs: KbRow[]): Map<string, VectorGroup> {
    const groups = new Map<string, VectorGroup>();
    for (const kb of kbs) {
      if (kb.embeddingDimension == null) continue;
      if (!SUPPORTED_EMBEDDING_DIMS.has(kb.embeddingDimension)) {
        this.logger.error(
          `Skipping KB ${kb.id}: dimension ${kb.embeddingDimension} has no partial HNSW index. Add the dimension to SUPPORTED_EMBEDDING_DIMS and create a partial HNSW migration.`,
        );
        continue;
      }
      // (model, dim, embeddingLlmConfigId) 조합이 같아야 같은 그룹.
      // null (워크스페이스 default) 도 별도 키 'default' 로 구분해 명확히 표기.
      const cfgKey = kb.embeddingLlmConfigId ?? 'default';
      const key = `${kb.embeddingModel}::${kb.embeddingDimension}::${cfgKey}`;
      const existing = groups.get(key);
      if (existing) {
        existing.kbIds.push(kb.id);
      } else {
        groups.set(key, {
          model: kb.embeddingModel,
          dim: kb.embeddingDimension,
          embeddingLlmConfigId: kb.embeddingLlmConfigId,
          kbIds: [kb.id],
        });
      }
    }
    return groups;
  }

  private isGraphKbSearchable(kb: KbRow): boolean {
    if (kb.embeddingDimension == null) return false;
    if (!SUPPORTED_EMBEDDING_DIMS.has(kb.embeddingDimension)) {
      this.logger.error(
        `Skipping graph KB ${kb.id}: dimension ${kb.embeddingDimension} has no partial HNSW index.`,
      );
      return false;
    }
    return true;
  }

  private async searchVectorGroup(
    group: VectorGroup,
    query: string,
    threshold: number,
    topK: number,
    workspaceId: string,
  ): Promise<SearchResult[]> {
    const { model, dim, kbIds, embeddingLlmConfigId } = group;
    // 그룹의 KB 들이 임베딩에 사용한 LLMConfig (null 이면 ws default) 로 query 임베딩.
    const llmConfig = await this.llmService.resolveConfig(
      embeddingLlmConfigId ?? undefined,
      workspaceId,
    );
    const embeddings = await this.llmService.embed(llmConfig, [query], model);
    const queryEmbedding = embeddings[0];
    if (!queryEmbedding || queryEmbedding.length !== dim) {
      this.logger.warn(
        `Skipping group model=${model} dim=${dim}: returned embedding has unexpected dimension ${queryEmbedding?.length}`,
      );
      return [];
    }
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const cast = getEmbeddingCastType(dim);
    const castExpr = `${cast}(${dim})`;

    const rows = await this.dataSource.query<RawSearchRow[]>(
      `SELECT
        dc.id AS "chunkId",
        dc.document_id AS "documentId",
        d.name AS "documentName",
        dc.content,
        dc.metadata,
        1 - (dc.embedding::${castExpr} <=> $1::${castExpr}) AS score
      FROM document_chunk dc
      JOIN document d ON d.id = dc.document_id
      JOIN knowledge_base kb ON kb.id = d.knowledge_base_id AND kb.workspace_id = $5
      WHERE vector_dims(dc.embedding) = ${dim}
        AND d.knowledge_base_id = ANY($2::uuid[])
        AND d.embedding_status = 'completed'
        AND dc.embedding IS NOT NULL
        AND 1 - (dc.embedding::${castExpr} <=> $1::${castExpr}) >= $3
      ORDER BY score DESC
      LIMIT $4`,
      [vectorStr, kbIds, threshold, topK, workspaceId],
    );

    return rows.map((r) => ({
      chunkId: r.chunkId,
      documentId: r.documentId,
      documentName: r.documentName,
      content: r.content,
      score: parseFloat(r.score),
      metadata: r.metadata || {},
    }));
  }

  // graph 모드 KB 검색 — Hybrid 흐름:
  // 1) vector seed top-K 회수 (해당 KB 단독)
  // 2) seed chunk 가 언급한 entity 들에서 1~maxHops traversal (recursive CTE)
  // 3) expanded entity 들이 등장한 chunk 추가 회수 (expandedChunkLimit 상한)
  // 4) seed + expanded 통합. expanded 는 centrality 가중치를 적용.
  // entity_count = 0 (추출 미완료) 이면 자동으로 vector seed 만 회수되어 graceful fallback.
  private async searchGraphKb(
    kb: KbRow,
    query: string,
    threshold: number,
    workspaceId: string,
  ): Promise<GraphGroupResult> {
    if (kb.embeddingDimension == null) {
      return {
        rows: [],
        seedChunkCount: 0,
        traversedEntityCount: 0,
        expandedChunkCount: 0,
        maxDepthUsed: 0,
      };
    }
    const dim = kb.embeddingDimension;
    // KB 가 청크 임베딩에 사용한 LLMConfig 로 query 임베딩 (mismatch 방지).
    const llmConfig = await this.llmService.resolveConfig(
      kb.embeddingLlmConfigId ?? undefined,
      workspaceId,
    );
    const embeddings = await this.llmService.embed(
      llmConfig,
      [query],
      kb.embeddingModel,
    );
    const queryEmbedding = embeddings[0];
    if (!queryEmbedding || queryEmbedding.length !== dim) {
      this.logger.warn(
        `Skipping graph KB ${kb.id}: returned embedding has unexpected dimension ${queryEmbedding?.length}`,
      );
      return {
        rows: [],
        seedChunkCount: 0,
        traversedEntityCount: 0,
        expandedChunkCount: 0,
        maxDepthUsed: 0,
      };
    }
    const vectorStr = `[${queryEmbedding.join(',')}]`;
    const cast = getEmbeddingCastType(dim);
    const castExpr = `${cast}(${dim})`;
    const seedTopK = kb.vectorSeedTopK;
    const expandLimit = kb.expandedChunkLimit;
    const maxHops = kb.maxHops;

    // 단일 SQL 로 seed + expansion + rerank 까지 처리.
    // seed CTE: vector top-K (threshold 적용)
    // seed_entities: chunk_entity 매핑으로 entity 집합 추출
    // expanded_entities: recursive CTE 로 maxHops 깊이까지 head/tail 양방향 traversal
    // expanded_chunks: expanded entity 들이 언급된 청크 (seed 제외) 상위 expandLimit 개
    // 최종: seed (origin='seed') + expanded (origin='expanded') 통합. expanded 는
    //       cosine score × log-scale centrality_weight 로 가중.
    // expanded_entities CTE 가 자기 자신을 참조하는 재귀 traversal 이므로 WITH 절에 RECURSIVE
    // 키워드가 반드시 필요하다. PostgreSQL 은 WITH RECURSIVE 가 없으면 self-reference 를
    // 외부 relation 으로 해석해 "relation 'expanded_entities' does not exist" 로 실패한다.
    const rows = await this.dataSource.query<RawSearchRow[]>(
      `WITH RECURSIVE seed AS (
         SELECT dc.id AS chunk_id, dc.document_id, d.name AS document_name, dc.content, dc.metadata,
                1 - (dc.embedding::${castExpr} <=> $1::${castExpr}) AS score
         FROM document_chunk dc
         JOIN document d ON d.id = dc.document_id
         JOIN knowledge_base kb ON kb.id = d.knowledge_base_id AND kb.workspace_id = $4
         WHERE kb.id = $2
           AND vector_dims(dc.embedding) = ${dim}
           AND d.embedding_status = 'completed'
           AND dc.embedding IS NOT NULL
           AND 1 - (dc.embedding::${castExpr} <=> $1::${castExpr}) >= $3
         ORDER BY score DESC
         LIMIT $5
       ),
       seed_entities AS (
         SELECT DISTINCT ce.entity_id
         FROM chunk_entity ce
         JOIN seed s ON s.chunk_id = ce.chunk_id
       ),
       expanded_entities AS (
         SELECT entity_id, 0 AS depth FROM seed_entities
         UNION
         SELECT
           CASE
             WHEN r.head_entity_id = e.entity_id THEN r.tail_entity_id
             ELSE r.head_entity_id
           END AS entity_id,
           e.depth + 1 AS depth
         FROM expanded_entities e
         JOIN relation r ON (r.head_entity_id = e.entity_id OR r.tail_entity_id = e.entity_id)
         WHERE e.depth < $6 AND r.knowledge_base_id = $2
       ),
       max_mention AS (
         SELECT GREATEST(COALESCE(MAX(mention_count), 1), 1) AS m
         FROM entity WHERE knowledge_base_id = $2
       ),
       expanded_chunks AS (
         SELECT DISTINCT ce.chunk_id,
                MAX(ent.mention_count) AS mention_count
         FROM chunk_entity ce
         JOIN expanded_entities ee ON ee.entity_id = ce.entity_id
         JOIN entity ent ON ent.id = ce.entity_id
         WHERE ce.chunk_id NOT IN (SELECT chunk_id FROM seed)
         GROUP BY ce.chunk_id
       )
       SELECT * FROM (
         SELECT s.chunk_id AS "chunkId",
                s.document_id AS "documentId",
                s.document_name AS "documentName",
                s.content,
                s.metadata,
                s.score,
                'seed' AS origin
         FROM seed s
         UNION ALL
         SELECT ec.chunk_id AS "chunkId",
                d.id AS "documentId",
                d.name AS "documentName",
                dc.content,
                dc.metadata,
                (1 - (dc.embedding::${castExpr} <=> $1::${castExpr}))
                  * (LOG(GREATEST(ec.mention_count, 1) + 1) / LOG((SELECT m FROM max_mention) + 1)) AS score,
                'expanded' AS origin
         FROM expanded_chunks ec
         JOIN document_chunk dc ON dc.id = ec.chunk_id
         JOIN document d ON d.id = dc.document_id
         WHERE d.embedding_status = 'completed'
           AND dc.embedding IS NOT NULL
           AND vector_dims(dc.embedding) = ${dim}
       ) t
       ORDER BY t.score DESC
       LIMIT $7`,
      [
        vectorStr,
        kb.id,
        threshold,
        workspaceId,
        seedTopK,
        maxHops,
        seedTopK + expandLimit,
      ],
    );

    const seedRows: SearchResult[] = [];
    const expandedRows: SearchResult[] = [];
    for (const r of rows) {
      const s: SearchResult = {
        chunkId: r.chunkId,
        documentId: r.documentId,
        documentName: r.documentName,
        content: r.content,
        score: parseFloat(r.score),
        metadata: r.metadata || {},
        origin: r.origin === 'seed' ? 'seed' : 'expanded',
      };
      if (s.origin === 'seed') seedRows.push(s);
      else expandedRows.push(s);
    }

    // 메타 추적: traversed entity 수는 별도 SQL 로 빠르게 조회 (위 CTE 안에서는 LIMIT 처리 후라 정확하지 않을 수 있음).
    let traversedEntityCount = 0;
    if (seedRows.length > 0) {
      const entRows = await this.dataSource.query<{ count: number }[]>(
        `WITH seed_entities AS (
           SELECT DISTINCT ce.entity_id
           FROM chunk_entity ce
           WHERE ce.chunk_id = ANY($1::uuid[])
         ),
         expanded AS (
           SELECT entity_id, 0 AS depth FROM seed_entities
           UNION
           SELECT
             CASE
               WHEN r.head_entity_id = e.entity_id THEN r.tail_entity_id
               ELSE r.head_entity_id
             END AS entity_id,
             e.depth + 1 AS depth
           FROM expanded e
           JOIN relation r ON (r.head_entity_id = e.entity_id OR r.tail_entity_id = e.entity_id)
           WHERE e.depth < $2 AND r.knowledge_base_id = $3
         )
         SELECT COUNT(DISTINCT entity_id)::int AS count FROM expanded`,
        [seedRows.map((s) => s.chunkId), maxHops, kb.id],
      );
      traversedEntityCount = entRows[0]?.count ?? 0;
    }

    return {
      rows: [...seedRows, ...expandedRows],
      seedChunkCount: seedRows.length,
      traversedEntityCount,
      expandedChunkCount: expandedRows.length,
      maxDepthUsed: maxHops,
    };
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
