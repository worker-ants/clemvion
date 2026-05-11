import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import pLimit from 'p-limit';
import { DataSource, Repository } from 'typeorm';
import { Document } from '../entities/document.entity';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { LlmService } from '../../llm/llm.service';
import { sanitizeLlmErrorMessage } from '../../llm/utils/sanitize-error.util';
import { WebsocketService } from '../../websocket/websocket.service';
import {
  GRAPH_EXTRACTION_SYSTEM_PROMPT,
  GRAPH_EXTRACTION_JSON_SCHEMA,
  ExtractionResult,
} from './graph-extraction.prompt';
import { ENTITY_TYPES } from '../entities/entity.entity';
import { KbStatsHelper } from './kb-stats.helper';
import {
  isRetryableLlmError,
  retryWithBackoff,
} from '../utils/retry-with-backoff.util';

const MAX_CHUNK_CHARS = 8_000; // chunk 본문이 매우 길면 LLM 호출 토큰 폭발 방지 차원에서 잘라낸다.

// 청크 LLM 호출 동시성 상한. concurrency 너무 높으면 LLM rate limit 충돌, 낮으면 처리 시간 N배.
// EmbeddingService 의 batch(20) 처리량 대비 절충선으로 3 채택.
const CHUNK_LLM_CONCURRENCY = 3;

// 청크별 LLM 호출에 적용할 timeout. JSON schema 응답이라 embedding 보다 길게.
const GRAPH_CHUNK_TIMEOUT_MS = 90_000;

// 자동 재시도 설정 — 임베딩과 동일 (baseDelayMs * 4^i → 1s, 4s, 16s + ±30% jitter).
const GRAPH_MAX_RETRIES = 3;
const GRAPH_BASE_DELAY_MS = 1_000;
// error_message 컬럼 길이 cap — provider 비정상 응답 시 스토리지 폭발 방지.
const ERROR_MESSAGE_MAX_LEN = 2_000;

function capErrorMessage(message: string): string {
  return message.length > ERROR_MESSAGE_MAX_LEN
    ? message.slice(0, ERROR_MESSAGE_MAX_LEN)
    : message;
}

// LLM 출력 길이 제한 — 악의적/오작동 LLM 이 거대 문자열을 반환할 때 스토리지 DoS 방지.
const MAX_NAME_LEN = 200;
const MAX_DISPLAY_NAME_LEN = 256;
const MAX_DESCRIPTION_LEN = 1024;
const MAX_PREDICATE_LEN = 100;

// entity name / predicate 허용 문자셋. 한국어/영어/숫자/공백/구두점 + 하이픈/언더스코어.
// 수상한 control char 를 거른다 (UPSERT 는 parameter 로 SQL injection 안전하지만
// 사용자 노출 시점 사전 정규화 차원).
const SAFE_TEXT_REGEX = /^[\p{L}\p{N}\p{P}\p{Z}\-_\s]+$/u;

function safeSlice(value: string | null | undefined, max: number): string {
  if (!value) return '';
  const trimmed = value.trim().slice(0, max);
  return trimmed;
}

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
 *
 * 재시도 정책 (spec/5-system/10-graph-rag.md "Retry & Failure"):
 * - 문서 단위로 retryWithBackoff 1s / 4s / 16s 백오프 3회 (timeout / 5xx / network 일시 오류)
 * - chunk_entity 재진입 안전성은 try 진입부의 DELETE 로 idempotent 보장
 * - 재시도 진행 중: graph_extraction_status='error' + graph_retry_count++ + WS document:graph_retry
 * - 재시도 소진 / 비재시도성 오류: graph_extraction_status='failed' + WS document:graph_failed
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
    private readonly kbStats: KbStatsHelper,
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
      await retryWithBackoff(() => this.doExtract(documentId, kb), {
        maxRetries: GRAPH_MAX_RETRIES,
        baseDelayMs: GRAPH_BASE_DELAY_MS,
        isRetryable: isRetryableLlmError,
        onAttempt: async (idx, err, willRetry) => {
          const safe = capErrorMessage(
            sanitizeLlmErrorMessage(
              err instanceof Error ? err.message : String(err),
            ),
          );
          this.logger.warn(
            `Graph extraction attempt ${idx + 1} failed for document ${documentId}` +
              (willRetry ? ' — scheduling retry' : ' — final failure') +
              `: ${safe}`,
          );
          await this.documentRepository.increment(
            { id: documentId },
            'graphRetryCount',
            1,
          );
          if (willRetry) {
            await this.documentRepository.update(documentId, {
              graphExtractionStatus: 'error',
              graphErrorMessage: safe,
              graphLastAttemptedAt: new Date(),
            });
            this.emitEvent(documentId, 'document:graph_retry', {
              attempt: idx + 1,
              maxAttempts: GRAPH_MAX_RETRIES + 1,
              error: safe,
            });
          }
          // willRetry=false: outer catch 가 곧 'failed' 로 단일 UPDATE → 이중 DB 쓰기 회피
        },
      });
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : String(err);
      const safeMessage = capErrorMessage(sanitizeLlmErrorMessage(rawMessage));
      this.logger.error(
        `Graph extraction failed permanently for document ${documentId}: ${rawMessage}`,
      );
      await this.documentRepository.update(documentId, {
        graphExtractionStatus: 'failed',
        graphErrorMessage: safeMessage,
        graphLastAttemptedAt: new Date(),
      });
      this.emitEvent(documentId, 'document:graph_failed', {
        error: safeMessage,
      });
    }
  }

  // 본 추출 본체 — retryWithBackoff 안에서 idempotent 하게 호출됨.
  // (앞 단계의 chunk_entity DELETE 가 매 attempt 마다 수행되어 부분 실패 후에도
  //  같은 KB·entity dedup INSERT 가 안전하게 누적됨.)
  // KB 객체는 외부에서 한 번 fetch 한 결과를 주입받아 재시도마다 추가 SELECT 를 피한다.
  private async doExtract(
    documentId: string,
    kb: KnowledgeBase,
  ): Promise<void> {
    await this.documentRepository.update(documentId, {
      graphExtractionStatus: 'processing',
      graphLastAttemptedAt: new Date(),
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
        graphRetryCount: 0,
        graphErrorMessage: null,
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
    const limit = pLimit(CHUNK_LLM_CONCURRENCY);
    let processed = 0;
    const tasks = chunks.map((chunk) =>
      limit(async () => {
        const result = await this.callLlmForChunk(llmConfig, chunk);
        const { entitiesInserted, relationsInserted } =
          await this.persistExtraction(kb.id, chunk.id, result);
        totalEntityDelta += entitiesInserted;
        totalRelationDelta += relationsInserted;

        processed += 1;
        const progress = Math.round((processed / chunks.length) * 100);
        this.emitEvent(documentId, 'document:graph_progress', {
          progress,
          entityDelta: entitiesInserted,
          relationDelta: relationsInserted,
        });
      }),
    );
    await Promise.all(tasks);

    // KB 캐시 컬럼 갱신 (실제 카운트로 다시 계산해 drift 방지)
    await this.kbStats.refresh(kb.id);

    await this.documentRepository.update(documentId, {
      graphExtractionStatus: 'completed',
      graphRetryCount: 0,
      graphErrorMessage: null,
    });
    this.emitEvent(documentId, 'document:graph_completed', {
      entityDelta: totalEntityDelta,
      relationDelta: totalRelationDelta,
    });
  }

  private async callLlmForChunk(
    llmConfig: Parameters<LlmService['chat']>[0],
    chunk: DocumentChunk,
  ): Promise<ExtractionResult> {
    const content =
      chunk.content.length > MAX_CHUNK_CHARS
        ? chunk.content.slice(0, MAX_CHUNK_CHARS)
        : chunk.content;

    const result = await this.llmService.chat(
      llmConfig,
      {
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
      },
      undefined,
      // disableInnerRetry: 외부 retryWithBackoff 가 재시도를 통제하므로 LlmService 내부의
      // rate-limit-only withRetry 와 겹쳐 LLM 호출이 비선형 증폭되는 것을 막는다.
      { timeoutMs: GRAPH_CHUNK_TIMEOUT_MS, disableInnerRetry: true },
    );

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
      // LLM 출력 안전 가드: 길이 제한, 허용 문자셋, type enum 검증.
      const nameToEntityId = new Map<string, string>(); // key: `${name}::${type}`
      let entitiesInserted = 0;
      for (const e of result.entities) {
        const rawName = safeSlice(e.name?.toLowerCase(), MAX_NAME_LEN);
        if (!rawName) continue;
        if (!SAFE_TEXT_REGEX.test(rawName)) {
          this.logger.warn(
            `Drop entity name with disallowed characters (kb=${knowledgeBaseId}, chunk=${chunkId})`,
          );
          continue;
        }
        // ENTITY_TYPES 에 없는 타입은 'other' 로 fallback (DB CHECK 보호 + LLM 환각 방지)
        const safeType = ENTITY_TYPES.includes(e.type as never)
          ? e.type
          : 'other';
        const safeDisplayName =
          safeSlice(e.displayName, MAX_DISPLAY_NAME_LEN) || rawName;
        const safeDescription = e.description
          ? safeSlice(e.description, MAX_DESCRIPTION_LEN)
          : null;

        const upsertResult = await manager.query<
          { id: string; inserted: boolean }[]
        >(
          // xmax = 0 은 PostgreSQL 의 INSERT 직후 row 식별 트릭 — 새로 INSERT 된 row 만 매칭.
          // ON CONFLICT 로 UPDATE 된 행은 xmax 가 트랜잭션 ID 라 0 이 아니므로 inserted=false.
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
            rawName,
            safeDisplayName,
            safeType,
            safeDescription,
            chunkId,
          ],
        );
        const row = upsertResult[0];
        if (!row) continue;
        nameToEntityId.set(`${rawName}::${safeType}`, row.id);
        if (row.inserted) entitiesInserted += 1;
      }

      // 2) chunk_entity 매핑 (PK 충돌 시 무시 — 같은 chunk 가 같은 entity 를 두 번 언급해도 1회만)
      for (const e of result.entities) {
        const normalizedName = safeSlice(e.name?.toLowerCase(), MAX_NAME_LEN);
        const safeType = ENTITY_TYPES.includes(e.type as never)
          ? e.type
          : 'other';
        const entityId = nameToEntityId.get(`${normalizedName}::${safeType}`);
        if (!entityId) continue;
        await manager.query(
          `INSERT INTO chunk_entity (chunk_id, entity_id, mention_text)
           VALUES ($1, $2, $3)
           ON CONFLICT (chunk_id, entity_id) DO NOTHING`,
          [chunkId, entityId, safeSlice(e.displayName, MAX_DISPLAY_NAME_LEN)],
        );
      }

      // 3) relation UPSERT — head/tail 가 응답 entities 안에 존재해야 한다 (LLM 환각 방지)
      let relationsInserted = 0;
      for (const r of result.relations) {
        const headName = safeSlice(r.head?.toLowerCase(), MAX_NAME_LEN);
        const tailName = safeSlice(r.tail?.toLowerCase(), MAX_NAME_LEN);
        const predicate = safeSlice(r.predicate, MAX_PREDICATE_LEN);
        if (!headName || !tailName || !predicate) continue;
        if (!SAFE_TEXT_REGEX.test(predicate)) {
          this.logger.warn(
            `Drop relation predicate with disallowed characters (chunk ${chunkId})`,
          );
          continue;
        }
        // 응답 안에서 head/tail 가 어떤 type 인지 결정 — 동일 name 의 type 후보가 여러 개면
        // 가장 먼저 매칭되는 entity 를 채택. (LLM 응답 entities 가 유일한 source of truth)
        const headEntry = result.entities.find(
          (e) => safeSlice(e.name?.toLowerCase(), MAX_NAME_LEN) === headName,
        );
        const tailEntry = result.entities.find(
          (e) => safeSlice(e.name?.toLowerCase(), MAX_NAME_LEN) === tailName,
        );
        if (!headEntry || !tailEntry) {
          this.logger.warn(
            `Drop relation: head=${headName} or tail=${tailName} not in extracted entities (chunk ${chunkId})`,
          );
          continue;
        }
        const headType = ENTITY_TYPES.includes(headEntry.type as never)
          ? headEntry.type
          : 'other';
        const tailType = ENTITY_TYPES.includes(tailEntry.type as never)
          ? tailEntry.type
          : 'other';
        const headId = nameToEntityId.get(`${headName}::${headType}`);
        const tailId = nameToEntityId.get(`${tailName}::${tailType}`);
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
          [knowledgeBaseId, headId, tailId, predicate, chunkId],
        );
        const row = upsertResult[0];
        if (row?.inserted) relationsInserted += 1;
      }

      return { entitiesInserted, relationsInserted };
    });
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
