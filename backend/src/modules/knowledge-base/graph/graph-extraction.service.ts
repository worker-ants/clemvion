import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { LlmService } from '../../llm/llm.service';
import { WebsocketService } from '../../websocket/websocket.service';
import {
  GRAPH_EXTRACTION_SYSTEM_PROMPT,
  GRAPH_EXTRACTION_JSON_SCHEMA,
  ExtractionResult,
} from './graph-extraction.prompt';

const MAX_CHUNK_CHARS = 8_000; // chunk 본문이 매우 길면 LLM 호출 토큰 폭발 방지 차원에서 잘라낸다.

/**
 * graph 모드 KB 의 문서에서 entity/relation 을 LLM 으로 추출하고 KB 단위로 dedup INSERT.
 *
 * - chunk 마다 LLM 호출 (KB.extractionLlmConfigId 또는 워크스페이스 default LLMConfig)
 * - entity 는 (knowledge_base_id, name, type) UNIQUE 충돌 시 mention_count += 1
 * - relation 은 (knowledge_base_id, head, predicate, tail) UNIQUE 충돌 시 weight += 1
 * - chunk_entity 는 (chunk_id, entity_id) PK 충돌 시 무시 (동일 chunk 의 재추출 안전)
 * - 추출 진행/완료/에러 이벤트는 WebSocket 으로 emit
 *
 * vector 모드 KB 의 문서가 들어오면 즉시 skip (GraphExtractionProcessor 에서 큐잉되지
 * 않지만 방어적으로 한 번 더 검증).
 */
@Injectable()
export class GraphExtractionService {
  private readonly logger = new Logger(GraphExtractionService.name);

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentChunk)
    private readonly chunkRepository: Repository<DocumentChunk>,
    @InjectRepository(KnowledgeBase)
    private readonly kbRepository: Repository<KnowledgeBase>,
    private readonly llmService: LlmService,
    @Inject(forwardRef(() => WebsocketService))
    private readonly websocketService: WebsocketService,
    private readonly dataSource: DataSource,
  ) {}

  async extractDocument(documentId: string): Promise<void> {
    const doc = await this.documentRepository.findOne({
      where: { id: documentId },
    });
    if (!doc) {
      this.logger.warn(`extractDocument: document ${documentId} not found`);
      return;
    }

    const kb = await this.kbRepository.findOne({
      where: { id: doc.knowledgeBaseId },
    });
    if (!kb) {
      this.logger.warn(
        `extractDocument: KB ${doc.knowledgeBaseId} not found for document ${documentId}`,
      );
      return;
    }

    if (kb.ragMode !== 'graph') {
      // 잘못 큐잉된 경우. silent skip.
      return;
    }

    try {
      await this.documentRepository.update(documentId, {
        graphExtractionStatus: 'processing',
      });
      this.emitEvent(documentId, 'document:graph_started', {
        knowledgeBaseId: kb.id,
      });

      // 재추출 안전성을 위해 본 문서의 기존 chunk_entity 매핑을 먼저 제거.
      // entity / relation 자체는 KB 단위 dedup 이라 다른 문서의 매핑이 살아있을 수 있으므로 보존.
      await this.dataSource.query(
        `DELETE FROM chunk_entity WHERE chunk_id IN (
           SELECT id FROM document_chunk WHERE document_id = $1
         )`,
        [documentId],
      );

      const chunks = await this.chunkRepository.find({
        where: { documentId },
        order: { chunkIndex: 'ASC' },
      });
      if (chunks.length === 0) {
        await this.documentRepository.update(documentId, {
          graphExtractionStatus: 'completed',
        });
        this.emitEvent(documentId, 'document:graph_completed', {
          entityDelta: 0,
          relationDelta: 0,
        });
        return;
      }

      const llmConfig = await this.llmService.resolveConfig(
        kb.extractionLlmConfigId ?? undefined,
        kb.workspaceId,
      );

      let totalEntityDelta = 0;
      let totalRelationDelta = 0;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const result = await this.callLlmForChunk(llmConfig, chunk);
        const { entitiesInserted, relationsInserted } =
          await this.persistExtraction(kb.id, chunk.id, result);
        totalEntityDelta += entitiesInserted;
        totalRelationDelta += relationsInserted;

        const progress = Math.round(((i + 1) / chunks.length) * 100);
        this.emitEvent(documentId, 'document:graph_progress', {
          progress,
          entityDelta: entitiesInserted,
          relationDelta: relationsInserted,
        });
      }

      // KB 캐시 컬럼 갱신 (실제 카운트로 다시 계산해 drift 방지)
      await this.refreshKbStats(kb.id);

      await this.documentRepository.update(documentId, {
        graphExtractionStatus: 'completed',
      });
      this.emitEvent(documentId, 'document:graph_completed', {
        entityDelta: totalEntityDelta,
        relationDelta: totalRelationDelta,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Graph extraction failed for document ${documentId}: ${message}`,
      );
      await this.documentRepository.update(documentId, {
        graphExtractionStatus: 'error',
        metadata: { ...doc.metadata, graphExtractionError: message },
      });
      this.emitEvent(documentId, 'document:graph_error', { error: message });
    }
  }

  private async callLlmForChunk(
    llmConfig: Parameters<LlmService['chat']>[0],
    chunk: DocumentChunk,
  ): Promise<ExtractionResult> {
    const content =
      chunk.content.length > MAX_CHUNK_CHARS
        ? chunk.content.slice(0, MAX_CHUNK_CHARS)
        : chunk.content;

    const result = await this.llmService.chat(llmConfig, {
      model: llmConfig.defaultModel,
      messages: [
        { role: 'system', content: GRAPH_EXTRACTION_SYSTEM_PROMPT },
        { role: 'user', content },
      ],
      responseFormat: 'json',
      jsonSchema: GRAPH_EXTRACTION_JSON_SCHEMA as unknown as Record<
        string,
        unknown
      >,
      temperature: 0,
    });

    if (!result.content) {
      return { entities: [], relations: [] };
    }
    try {
      return this.parseExtraction(result.content);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to parse extraction JSON for chunk ${chunk.id}: ${msg}`,
      );
      return { entities: [], relations: [] };
    }
  }

  private parseExtraction(raw: string): ExtractionResult {
    const parsed = JSON.parse(raw) as ExtractionResult;
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('Extraction response is not an object');
    }
    if (!Array.isArray(parsed.entities) || !Array.isArray(parsed.relations)) {
      throw new Error('Extraction response missing entities/relations arrays');
    }
    return parsed;
  }

  // entity / relation / chunk_entity 를 dedup INSERT 한다. 반환값은 신규 INSERT 된 행 수.
  private async persistExtraction(
    knowledgeBaseId: string,
    chunkId: string,
    result: ExtractionResult,
  ): Promise<{ entitiesInserted: number; relationsInserted: number }> {
    if (result.entities.length === 0 && result.relations.length === 0) {
      return { entitiesInserted: 0, relationsInserted: 0 };
    }

    return this.dataSource.transaction(async (manager) => {
      // 1) entity UPSERT — name 정규화는 LLM 측에서 해 주지만 추가로 lower/trim 한 번 더.
      const nameToEntityId = new Map<string, string>(); // key: `${name}::${type}`
      let entitiesInserted = 0;
      for (const e of result.entities) {
        const normalizedName = e.name.trim().toLowerCase();
        if (!normalizedName) continue;
        const upsertResult = await manager.query<
          { id: string; inserted: boolean }[]
        >(
          `INSERT INTO entity (knowledge_base_id, name, display_name, type, description, mention_count, last_seen_chunk_id, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 1, $6, NOW(), NOW())
           ON CONFLICT (knowledge_base_id, name, type)
           DO UPDATE SET
             mention_count = entity.mention_count + 1,
             last_seen_chunk_id = EXCLUDED.last_seen_chunk_id,
             display_name = COALESCE(entity.display_name, EXCLUDED.display_name),
             description = COALESCE(entity.description, EXCLUDED.description),
             updated_at = NOW()
           RETURNING id, (xmax = 0) AS inserted`,
          [
            knowledgeBaseId,
            normalizedName,
            e.displayName,
            e.type,
            e.description ?? null,
            chunkId,
          ],
        );
        const row = upsertResult[0];
        if (!row) continue;
        nameToEntityId.set(`${normalizedName}::${e.type}`, row.id);
        if (row.inserted) entitiesInserted += 1;
      }

      // 2) chunk_entity 매핑 (PK 충돌 시 무시 — 같은 chunk 가 같은 entity 를 두 번 언급해도 1회만)
      for (const e of result.entities) {
        const normalizedName = e.name.trim().toLowerCase();
        const entityId = nameToEntityId.get(`${normalizedName}::${e.type}`);
        if (!entityId) continue;
        await manager.query(
          `INSERT INTO chunk_entity (chunk_id, entity_id, mention_text)
           VALUES ($1, $2, $3)
           ON CONFLICT (chunk_id, entity_id) DO NOTHING`,
          [chunkId, entityId, e.displayName],
        );
      }

      // 3) relation UPSERT — head/tail 가 응답 entities 안에 존재해야 한다 (LLM 환각 방지)
      let relationsInserted = 0;
      for (const r of result.relations) {
        const headName = r.head.trim().toLowerCase();
        const tailName = r.tail.trim().toLowerCase();
        if (!headName || !tailName) continue;
        // 응답 안에서 head/tail 가 어떤 type 인지 결정 — 동일 name 의 type 후보가 여러 개면
        // 가장 먼저 매칭되는 entity 를 채택. (LLM 응답 entities 가 유일한 source of truth)
        const headEntry = result.entities.find(
          (e) => e.name.trim().toLowerCase() === headName,
        );
        const tailEntry = result.entities.find(
          (e) => e.name.trim().toLowerCase() === tailName,
        );
        if (!headEntry || !tailEntry) {
          this.logger.warn(
            `Drop relation: head=${headName} or tail=${tailName} not in extracted entities (chunk ${chunkId})`,
          );
          continue;
        }
        const headId = nameToEntityId.get(`${headName}::${headEntry.type}`);
        const tailId = nameToEntityId.get(`${tailName}::${tailEntry.type}`);
        if (!headId || !tailId) continue;

        const upsertResult = await manager.query<
          { id: string; inserted: boolean }[]
        >(
          `INSERT INTO relation (knowledge_base_id, head_entity_id, tail_entity_id, predicate, evidence_chunk_id, weight, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 1, NOW(), NOW())
           ON CONFLICT (knowledge_base_id, head_entity_id, predicate, tail_entity_id)
           DO UPDATE SET
             weight = relation.weight + 1,
             evidence_chunk_id = COALESCE(relation.evidence_chunk_id, EXCLUDED.evidence_chunk_id),
             updated_at = NOW()
           RETURNING id, (xmax = 0) AS inserted`,
          [knowledgeBaseId, headId, tailId, r.predicate, chunkId],
        );
        const row = upsertResult[0];
        if (row?.inserted) relationsInserted += 1;
      }

      return { entitiesInserted, relationsInserted };
    });
  }

  // KB 의 entity_count / relation_count 캐시를 실제 COUNT 로 다시 계산해 drift 를 막는다.
  // 추출 진행 중에 호출되면 일시적으로 작은 값이 노출될 수 있지만, 다음 chunk 처리에서 다시 갱신.
  private async refreshKbStats(knowledgeBaseId: string): Promise<void> {
    const rows = await this.dataSource.query<
      { entity_count: number; relation_count: number }[]
    >(
      `SELECT
         (SELECT COUNT(*)::int FROM entity WHERE knowledge_base_id = $1) AS entity_count,
         (SELECT COUNT(*)::int FROM relation WHERE knowledge_base_id = $1) AS relation_count`,
      [knowledgeBaseId],
    );
    const entityCount = rows[0]?.entity_count ?? 0;
    const relationCount = rows[0]?.relation_count ?? 0;
    await this.dataSource.query(
      `UPDATE knowledge_base SET entity_count = $1, relation_count = $2 WHERE id = $3`,
      [entityCount, relationCount, knowledgeBaseId],
    );
    try {
      this.websocketService.emitExecutionEvent(
        `kb:${knowledgeBaseId}`,
        'kb:graph_stats_updated' as never,
        { knowledgeBaseId, entityCount, relationCount },
      );
    } catch {
      // best-effort
    }
  }

  private emitEvent(
    documentId: string,
    event: string,
    payload: Record<string, unknown>,
  ): void {
    try {
      this.websocketService.emitExecutionEvent(
        `kb:${documentId}`,
        event as never,
        { documentId, ...payload },
      );
    } catch {
      // best-effort
    }
  }
}
