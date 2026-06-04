import { createHash } from 'crypto';
import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import type { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { LlmService } from '../llm/llm.service';
import {
  SUPPORTED_EMBEDDING_DIMS,
  getEmbeddingCastType,
} from '../knowledge-base/embedding/embedding-dimensions.const';
import {
  AGENT_MEMORY_EXTRACTION_QUEUE,
  AgentMemoryExtractionJob,
  ExtractionTurnSnapshot,
} from './queues/agent-memory-extraction.queue';

/**
 * scope 당 보존할 최신 메모리 건수 상한 (spec/5-system/17-agent-memory.md §4 forgetting,
 * spec/1-data-model.md §2.23). 초과 시 created_at 오래된 순으로 evict (FIFO/LRU).
 * ConversationThread.STORAGE_MAX_TURNS evict 패턴과 동형. TTL 만료는 v2 로드맵.
 */
export const AGENT_MEMORY_MAX_PER_SCOPE = 1000;

/**
 * 의미기반 dedup/갱신 임계치 (spec/5-system/17-agent-memory.md §4 forgetting,
 * AGM-09). 신규 추출 fact 의 임베딩이 같은 (workspace_id, scope_key) 의 기존
 * fact 와 cosine 유사도가 이 값 이상이면 INSERT 대신 그 기존 row 를 UPDATE
 * (같은 사실의 최신화 — Mem0 식). recall 의 cosine SQL 을 재사용한다.
 *
 * 0.85 — recall 기본 threshold(0.7)보다 보수적으로 높여, "관련은 있으나 다른
 * 사실"(0.7~0.85)은 별도 저장하고 "사실상 같은 사실"(≥0.85)만 갱신한다.
 */
export const MEMORY_DEDUP_SIMILARITY = 0.85;

/**
 * 임베딩에 사용할 LLMConfig·모델 출처. KnowledgeBase 의 (embeddingLlmConfigId, embeddingModel)
 * 해석 경로를 그대로 재사용한다 (EmbeddingService / RagSearchService 와 동형).
 *
 * - `llmConfigId`: truthy 면 그 LLMConfig, 아니면 워크스페이스 기본 LLMConfig (LlmService.resolveConfig).
 * - `embeddingModel`: 임베딩 모델 식별자. 미지정이면 KB default 와 동일한 `text-embedding-3-small`.
 *
 * KB 는 per-KB 컬럼으로 이 둘을 보관하지만 agent_memory 는 전용 config 컬럼이 없으므로,
 * 호출부 (AI Agent 핸들러) 가 노드/워크스페이스 컨텍스트에서 이 출처를 넘긴다. 회수·추출이
 * 같은 출처를 써야 query 임베딩과 저장 임베딩의 차원·endpoint 가 일치한다.
 */
export interface EmbedConfigSource {
  llmConfigId?: string | null;
  embeddingModel?: string | null;
}

// KB 가 사용하는 기본 임베딩 모델 (knowledge_base.embedding_model DEFAULT 와 동기화).
const DEFAULT_EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * scope_key 최대 길이 상한 (W-1). memoryKey 는 Expression 평가값이라 극단 길이
 * (예: 전체 transcript 를 키로 평가) 가 들어올 수 있다. 상한 초과 시 결정적
 * 해시(SHA-256) 로 축약해 동일 입력이 항상 동일 scope 에 매핑되도록 한다.
 */
const SCOPE_KEY_MAX_LENGTH = 512;

/**
 * 저장 전 1차 instruction-style 필터 (W-2 보조). 추출 단계가 사이에 있어도
 * 명백한 jailbreak/지시문 패턴이 메모리 content 로 새어 저장되면 이후 회수 주입
 * 시 (data-fence 로 1차 방어하더라도) 위험을 키운다. 명백한 패턴만 결정적으로
 * 걸러내는 가벼운 가드 — 정상 사실/선호는 통과시킨다 (false-positive 최소화).
 * 주(主) 방어는 주입 시점 data-fence wrap 이고, 이는 defense-in-depth 보조다.
 */
const INSTRUCTION_PATTERNS: RegExp[] = [
  /\bignore\s+(?:all\s+|the\s+|any\s+)?(?:previous|prior|above|earlier)\b/i,
  /\bdisregard\s+(?:all\s+|the\s+|any\s+)?(?:previous|prior|above|earlier)\b/i,
  /\bforget\s+(?:everything|all|previous|prior)\b/i,
  /\byou\s+are\s+now\b/i,
  /\bsystem\s*prompt\b/i,
  /\bnew\s+instructions?\s*:/i,
  /이전\s*(?:지시|명령|프롬프트)\w*\s*무시/,
];

function looksLikeInstruction(content: string): boolean {
  return INSTRUCTION_PATTERNS.some((re) => re.test(content));
}

/**
 * 두 임베딩 벡터의 cosine 유사도 (AGM-09 batch 내 dedup). DB round-trip 없이
 * 같은 batch 안의 신규 fact 끼리 비교한다 — recall/findSimilarFact 의 pgvector
 * cosine 과 동일 정의. 길이가 다르거나 0-norm 이면 0 (비유사) 반환.
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / Math.sqrt(normA * normB);
}

/**
 * `DataSource` 와 트랜잭션 `EntityManager` 모두가 만족하는 최소 쿼리 실행 인터페이스.
 * saveMemories 내부 헬퍼들이 트랜잭션 manager 로 실행될 수 있도록 (W2) 둘 다 받는다.
 */
interface QueryRunnerLike {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<T>;
}

export interface RecallOptions {
  topK?: number;
  threshold?: number;
}

export interface RecalledMemory {
  content: string;
  score: number;
}

export interface MemoryItem {
  content: string;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AgentMemoryService {
  private readonly logger = new Logger(AgentMemoryService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly llmService: LlmService,
    /**
     * 턴 경계 비동기 추출 큐 (spec §3, AGM-04). Optional — 큐가 미주입된
     * 환경(일부 단위 테스트)에서는 `scheduleExtraction` 이 graceful no-op 한다.
     */
    @Optional()
    @InjectQueue(AGENT_MEMORY_EXTRACTION_QUEUE)
    private readonly extractionQueue?: Queue<AgentMemoryExtractionJob>,
  ) {}

  /**
   * 턴 경계 비동기 추출 enqueue (spec §3, AGM-04 — producer).
   *
   * persistent 전략의 **턴 경계** (single-turn 최종 응답 후 / multi-turn 매 turn
   * 종료 후) 에서 핸들러가 호출한다. **hot path 비차단 invariant** — 본 메서드는
   * 큐 add (enqueue) 까지만 await 하고, 추출 LLM 콜은 worker(processor) 에서
   * 일어난다. `turns` 는 호출부가 넘기는 **shallow-copy 스냅샷** 이어야 하며
   * (격리 invariant §3), enqueue 실패는 로그만 남기고 삼켜 대화를 계속한다
   * (graceful — 추출 enqueue 실패가 응답 경로를 깨면 안 된다).
   *
   * 빈 turns / 큐 미주입 / workspaceId·scopeKey 결손 시 no-op.
   */
  async scheduleExtraction(args: {
    workspaceId: string;
    scopeKey: string;
    llmConfigId?: string | null;
    model?: string | null;
    turns: ExtractionTurnSnapshot[];
    ttlDays?: number | null;
  }): Promise<void> {
    if (!this.extractionQueue) return;
    if (!args.workspaceId || !args.scopeKey) return;
    if (!args.turns || args.turns.length === 0) return;
    try {
      await this.extractionQueue.add(
        'extract',
        {
          workspaceId: args.workspaceId,
          scopeKey: args.scopeKey,
          llmConfigId: args.llmConfigId ?? null,
          model: args.model ?? null,
          // 방어적 shallow-copy — 호출부가 이미 격리 스냅샷을 넘기지만,
          // producer 가 payload 직렬화 전 array 를 재참조하지 않도록 한 번 더.
          turns: [...args.turns],
          // TTL (일) — 노드 config memoryTtlDays → payload → processor → saveMemories (AGM-10).
          ttlDays: args.ttlDays ?? null,
        },
        {
          // W3 (TOCTOU 방지): 같은 (workspaceId, scopeKey) 의 추출 job 을 BullMQ
          // 가 dedup/직렬화하도록 jobId 를 scope 단위로 고정한다. processor
          // concurrency=2 에서도 같은 scope 의 findSimilarFact→insert 가 동시
          // 실행되지 않아 중복 insert 를 막는다 (advisory lock 보다 간단·충분).
          jobId: `agent-memory:${args.workspaceId}:${args.scopeKey}`,
          removeOnComplete: 100,
          removeOnFail: 100,
        },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Agent memory extraction enqueue failed: ${message}`);
    }
  }

  /**
   * 메모리 네임스페이스 키 resolve (spec §2, AGM-03):
   * - truthy `memoryKey` (Expression 평가값) → 세션 간 영속 (개인화)
   * - 미설정/빈값 → `executionId` fallback → 세션 단위 격리 (안전 디폴트)
   *
   * `workspace_id` 는 항상 별도 필터로 강제되며 (격리 의무 §5) scopeKey 안에 들어가지 않는다.
   *
   * **방어 (W-1)**: memoryKey 는 Expression 평가값이므로 제어문자/null byte 제거 +
   * 길이 상한 (SCOPE_KEY_MAX_LENGTH) 을 적용한다. SQL 은 이미 파라미터 바인딩이라
   * 인젝션은 막혀 있으나, 제어문자·극단 길이로 인한 인덱스/저장소 오염을 차단한다.
   * 상한 초과 시 결정적 해시로 축약 (동일 입력 → 동일 scope 보장).
   */
  resolveScopeKey(
    memoryKey: string | undefined | null,
    executionId: string,
  ): string {
    if (memoryKey != null) {
      const sanitized = this.sanitizeScopeKey(memoryKey);
      if (sanitized !== '') {
        return sanitized;
      }
    }
    // 빈/공백/제어문자-only → executionId fallback (세션 격리, 안전 디폴트).
    return executionId;
  }

  /**
   * scope_key 정규화 (W-1): null byte/제어문자 제거 → trim → 길이 상한 적용.
   * 상한 초과 시 SHA-256 해시 prefix 로 결정적 축약한다.
   */
  private sanitizeScopeKey(raw: string): string {
    // null byte 및 C0/C1 제어문자 제거 (탭/개행 포함 — scope_key 는 단일 토큰).
    // eslint-disable-next-line no-control-regex
    const cleaned = raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').trim();
    if (cleaned === '') return '';
    if (cleaned.length <= SCOPE_KEY_MAX_LENGTH) return cleaned;
    // 결정적 해시 축약 — 충돌 회피 위해 식별 가능한 prefix + 전체 해시.
    const hash = createHash('sha256').update(cleaned).digest('hex');
    // prefix(가독성) + ':' + hash. 합산 길이는 항상 상한 이하.
    const prefixLen = SCOPE_KEY_MAX_LENGTH - hash.length - 1;
    return `${cleaned.slice(0, prefixLen)}:${hash}`;
  }

  /**
   * 동기 top-k 의미검색 회수 (spec §4, AGM-05). RagSearchService 의 cosine 검색 SQL
   * (`1 - (embedding::<cast> <=> $q)`) 을 미러하되 대상 테이블은 agent_memory 이고
   * 필터는 (workspace_id, scope_key) 다. workspace_id 격리는 항상 강제된다 (§5, AGM-07).
   */
  async recall(
    workspaceId: string,
    scopeKey: string,
    queryText: string,
    embedCfgSource: EmbedConfigSource,
    opts?: RecallOptions,
  ): Promise<RecalledMemory[]> {
    if (!workspaceId || !scopeKey || !queryText?.trim()) {
      return [];
    }

    const topK = opts?.topK ?? 5;
    const threshold = opts?.threshold ?? 0.7;

    try {
      const queryEmbedding = await this.embedOne(
        queryText,
        workspaceId,
        embedCfgSource,
      );
      if (!queryEmbedding) return [];

      const dim = queryEmbedding.length;
      if (!SUPPORTED_EMBEDDING_DIMS.has(dim)) {
        this.logger.error(
          `Skipping agent_memory recall: dimension ${dim} has no partial HNSW index. ` +
            `Add the dimension to SUPPORTED_EMBEDDING_DIMS and create a partial HNSW migration.`,
        );
        return [];
      }

      const vectorStr = `[${queryEmbedding.join(',')}]`;
      const cast = getEmbeddingCastType(dim);
      const castExpr = `${cast}(${dim})`;

      // 검색 SQL 은 partial HNSW 인덱스(V072~V077)와 동일한 cast/차원 조건을 사용해야
      // 인덱스를 탄다. workspace_id + scope_key 로 네임스페이스 격리.
      const rows = await this.dataSource.query<
        { content: string; score: string }[]
      >(
        `SELECT
          am.content,
          1 - (am.embedding::${castExpr} <=> $1::${castExpr}) AS score
        FROM agent_memory am
        WHERE am.workspace_id = $2
          AND am.scope_key = $3
          AND vector_dims(am.embedding) = ${dim}
          AND am.embedding IS NOT NULL
          AND (am.expires_at IS NULL OR am.expires_at > now())
          AND 1 - (am.embedding::${castExpr} <=> $1::${castExpr}) >= $4
        ORDER BY score DESC
        LIMIT $5`,
        [vectorStr, workspaceId, scopeKey, threshold, topK],
      );

      return rows.map((r) => ({
        content: r.content,
        score: parseFloat(r.score),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Agent memory recall failed: ${message}`);
      return [];
    }
  }

  /**
   * 추출된 사실/선호를 임베딩 후 **의미기반 dedup/갱신 (Mem0 식)** 으로 저장한다
   * (spec §4, AGM-06/AGM-09). content 임베딩은 EmbeddingService/RagSearch 와
   * 동일한 LlmService.embed 경로를 쓴다.
   *
   * 각 신규 fact 의 임베딩으로 같은 (workspace_id, scope_key) 안에서
   * `findSimilarFact` (recall cosine SQL 재사용, LIMIT 1, MEMORY_DEDUP_SIMILARITY)
   * 로 유사 기존 fact 를 찾는다. 있으면 그 row 를 UPDATE (content/embedding/
   * metadata/updated_at 갱신 — 같은 사실의 최신화), 없으면 INSERT.
   * 같은 batch 안의 신규 fact 간 중복도 방지 — 직전 처리한 fact 와 유사하면
   * 그 row 를 다시 UPDATE 한다.
   *
   * `ttlDays` 가 양수면 INSERT/UPDATE 가 `expires_at = now() + ($N * INTERVAL
   * '1 day')` 을 **파라미터 바인딩** 으로 채운다 (C1). 미설정/0/음수 면 INSERT 는
   * 무만료(NULL), **UPDATE 는 기존 expires_at 을 보존** (W1 — 갱신이 기존 TTL 을
   * 소실시키지 않도록 SET 절에서 제외). 마지막에 forgetting evict (만료 row +
   * FIFO 초과분) 를 호출한다. 루프+evict 전체는 한 트랜잭션 (W2). 모든 쿼리는
   * workspace_id 격리 (§5, AGM-07).
   */
  async saveMemories(
    workspaceId: string,
    scopeKey: string,
    items: MemoryItem[],
    embedCfgSource: EmbedConfigSource,
    ttlDays?: number | null,
  ): Promise<void> {
    if (!workspaceId || !scopeKey) return;
    const valid = items.filter((it) => {
      if (!it.content?.trim()) return false;
      // W-2 보조: 명백한 instruction-style content 는 저장 단계에서 1차 차단.
      if (looksLikeInstruction(it.content)) {
        this.logger.warn(
          'Agent memory: dropping instruction-style extracted content before save',
        );
        return false;
      }
      return true;
    });
    if (valid.length === 0) return;

    const model =
      embedCfgSource.embeddingModel?.trim() || DEFAULT_EMBEDDING_MODEL;
    const llmConfig = await this.llmService.resolveConfig(
      embedCfgSource.llmConfigId ?? undefined,
      workspaceId,
    );
    const embeddings = await this.llmService.embed(
      llmConfig,
      valid.map((it) => it.content),
      model,
    );

    // ttlDays 양수면 TTL (일) 정규화 — INSERT/UPDATE 가 파라미터 바인딩으로
    // `now() + ($N * INTERVAL '1 day')` 을 채운다 (C1 — SQL 리터럴 보간 금지).
    // 미설정/0/음수 = 무만료 (디폴트). 한 batch 의 모든 항목이 같은 만료 정책을
    // 공유한다.
    const ttl = ttlDays != null && ttlDays > 0 ? ttlDays : null;

    // 부분 실패 정합성 (W2): dedup-insert/update 루프 + evict 전체를 한 트랜잭션
    // 으로 감싼다. 내부 쿼리는 manager 로 실행한다.
    await this.dataSource.transaction(async (manager) => {
      // 같은 batch 안에서 직전 항목들이 UPDATE/INSERT 한 row id 를 추적해, 후속
      // 항목이 그 row 와 유사하면 새 INSERT 대신 그 row 를 다시 갱신 (batch 내
      // 중복 방지). 사실상 같은 fact 가 한 추출 응답에 두 번 나오는 케이스.
      const batchSeen: { id: string; embedding: number[] }[] = [];

      for (let i = 0; i < valid.length; i++) {
        const item = valid[i];
        const embedding = embeddings[i];
        if (!embedding || embedding.length === 0) {
          throw new Error('Embedding vector is empty');
        }

        // 1) batch 내 직전 fact 중 유사한 것 — cosine 으로 in-memory 비교.
        const batchMatch = this.findSimilarInBatch(embedding, batchSeen);
        if (batchMatch) {
          await this.updateMemory(
            manager,
            batchMatch,
            item.content,
            embedding,
            item.metadata,
            ttl,
          );
          // I4: UPDATE 분기에도 갱신된 embedding 을 batchSeen 에 반영해야 같은
          // batch 의 후속 항목이 이 row 를 다시 탐지한다 (갱신 embedding 기준).
          this.recordBatchSeen(batchSeen, batchMatch, embedding);
          continue;
        }

        // 2) DB 의 기존 fact 중 유사한 것 (recall cosine SQL 재사용, LIMIT 1).
        const existingId = await this.findSimilarFact(
          manager,
          workspaceId,
          scopeKey,
          embedding,
        );
        if (existingId) {
          await this.updateMemory(
            manager,
            existingId,
            item.content,
            embedding,
            item.metadata,
            ttl,
          );
          this.recordBatchSeen(batchSeen, existingId, embedding);
          continue;
        }

        // 3) 신규 INSERT — id 회수해 batch 추적에 추가.
        const insertedId = await this.insertMemory(
          manager,
          workspaceId,
          scopeKey,
          item.content,
          embedding,
          item.metadata,
          ttl,
        );
        batchSeen.push({ id: insertedId, embedding });
      }

      await this.evictExpiredAndOldest(manager, workspaceId, scopeKey);
    });
  }

  /**
   * batch dedup 추적(batchSeen) 에 (id, embedding) 을 기록한다. 같은 id 가 이미
   * 있으면 embedding 만 최신 갱신값으로 덮어쓴다 (UPDATE 분기 — I4). 없으면 추가.
   */
  private recordBatchSeen(
    batchSeen: { id: string; embedding: number[] }[],
    id: string,
    embedding: number[],
  ): void {
    const existing = batchSeen.find((s) => s.id === id);
    if (existing) {
      existing.embedding = embedding;
    } else {
      batchSeen.push({ id, embedding });
    }
  }

  /**
   * 같은 (workspace_id, scope_key) 안에서 주어진 임베딩과 cosine 유사도가
   * MEMORY_DEDUP_SIMILARITY 이상인 기존 fact 의 id 를 1건 찾는다 (AGM-09).
   * recall 의 cosine SQL 을 미러하되 score 가 아닌 id 만, LIMIT 1 로 반환한다.
   * 만료 row 는 갱신 대상에서 제외 (recall 과 동일 필터). 지원되지 않는 차원/
   * 에러는 null (graceful — dedup 실패가 INSERT 경로를 막지 않게).
   */
  private async findSimilarFact(
    runner: QueryRunnerLike,
    workspaceId: string,
    scopeKey: string,
    embedding: number[],
  ): Promise<string | null> {
    const dim = embedding.length;
    if (!SUPPORTED_EMBEDDING_DIMS.has(dim)) return null;
    try {
      const vectorStr = `[${embedding.join(',')}]`;
      const cast = getEmbeddingCastType(dim);
      const castExpr = `${cast}(${dim})`;
      const rows = await runner.query<{ id: string }[]>(
        `SELECT am.id
         FROM agent_memory am
         WHERE am.workspace_id = $2
           AND am.scope_key = $3
           AND vector_dims(am.embedding) = ${dim}
           AND am.embedding IS NOT NULL
           AND (am.expires_at IS NULL OR am.expires_at > now())
           AND 1 - (am.embedding::${castExpr} <=> $1::${castExpr}) >= $4
         ORDER BY 1 - (am.embedding::${castExpr} <=> $1::${castExpr}) DESC
         LIMIT 1`,
        [vectorStr, workspaceId, scopeKey, MEMORY_DEDUP_SIMILARITY],
      );
      return rows[0]?.id ?? null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`Agent memory dedup lookup failed: ${message}`);
      return null;
    }
  }

  /** batch 내 직전 처리한 fact 중 cosine 유사도 ≥ 임계치인 row id (AGM-09). */
  private findSimilarInBatch(
    embedding: number[],
    seen: { id: string; embedding: number[] }[],
  ): string | null {
    for (const prev of seen) {
      if (prev.embedding.length !== embedding.length) continue;
      if (
        cosineSimilarity(prev.embedding, embedding) >= MEMORY_DEDUP_SIMILARITY
      ) {
        return prev.id;
      }
    }
    return null;
  }

  /**
   * 단일 fact INSERT — 생성된 id 반환 (batch dedup 추적용).
   *
   * `ttlDays` 양수면 `expires_at` 을 **파라미터 바인딩** 으로 채운다
   * (`now() + ($N * INTERVAL '1 day')`, C1 — ttlDays 를 SQL 리터럴로 보간하지
   * 않는다). null 이면 expires_at 절을 NULL 로 둔다 (무만료, AGM-10).
   */
  private async insertMemory(
    runner: QueryRunnerLike,
    workspaceId: string,
    scopeKey: string,
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> | undefined,
    ttlDays: number | null,
  ): Promise<string> {
    const vectorStr = `[${embedding.join(',')}]`;
    const params: unknown[] = [
      workspaceId,
      scopeKey,
      content,
      vectorStr,
      JSON.stringify(metadata ?? {}),
    ];
    // expires_at: ttlDays 양수면 $6 로 일수를 바인딩, 아니면 NULL.
    const expiresAtExpr =
      ttlDays != null ? `now() + ($6 * INTERVAL '1 day')` : 'NULL';
    if (ttlDays != null) params.push(ttlDays);
    const rows = await runner.query<{ id: string }[]>(
      `INSERT INTO agent_memory (workspace_id, scope_key, content, embedding, metadata, expires_at)
       VALUES ($1, $2, $3, $4::vector, $5, ${expiresAtExpr})
       RETURNING id`,
      params,
    );
    return rows[0].id;
  }

  /**
   * 유사 기존 fact 를 최신 content/embedding/metadata 으로 갱신
   * (AGM-09 — 같은 사실의 최신화). updated_at 은 갱신 시각으로 바꾼다.
   *
   * **TTL 보존 (W1)**: `ttlDays` 가 제공된 경우(양수)에만 `expires_at` 을 재설정
   * (파라미터 바인딩 — C1). null 이면 기존 row 의 `expires_at` 을 **건드리지 않는다**
   * (SET 절에서 제외) — 갱신이 기존 TTL 을 의도치 않게 소실시키지 않도록.
   */
  private async updateMemory(
    runner: QueryRunnerLike,
    id: string,
    content: string,
    embedding: number[],
    metadata: Record<string, unknown> | undefined,
    ttlDays: number | null,
  ): Promise<void> {
    const vectorStr = `[${embedding.join(',')}]`;
    const params: unknown[] = [
      id,
      content,
      vectorStr,
      JSON.stringify(metadata ?? {}),
    ];
    // ttlDays 제공 시에만 expires_at 재설정 ($5 바인딩). 미설정이면 SET 절에서
    // 제외해 기존 만료를 보존한다 (W1).
    const expiresAtSet =
      ttlDays != null
        ? `,\n           expires_at = now() + ($5 * INTERVAL '1 day')`
        : '';
    if (ttlDays != null) params.push(ttlDays);
    await runner.query(
      `UPDATE agent_memory
       SET content = $2,
           embedding = $3::vector,
           metadata = $4${expiresAtSet},
           updated_at = now()
       WHERE id = $1`,
      params,
    );
  }

  /**
   * forgetting evict (spec §4, AGM-06/AGM-10): 두 단계로 삭제한다.
   *  1. **TTL 만료** — `expires_at < now()` 인 row 삭제 (partial index 활용).
   *  2. **FIFO/LRU** — 만료 정리 후 (workspace_id, scope_key) 당 최신
   *     N=AGENT_MEMORY_MAX_PER_SCOPE 건만 보존, 초과는 created_at 오래된 순
   *     (동률은 id) 삭제. ConversationThread 의 STORAGE_MAX_TURNS evict 와 동형.
   * workspace_id 격리 강제.
   */
  private async evictExpiredAndOldest(
    runner: QueryRunnerLike,
    workspaceId: string,
    scopeKey: string,
  ): Promise<void> {
    // 1) TTL 만료 row 삭제 — partial index idx_agent_memory_expires_at 활용.
    await runner.query(
      `DELETE FROM agent_memory
       WHERE workspace_id = $1 AND scope_key = $2
         AND expires_at IS NOT NULL AND expires_at < now()`,
      [workspaceId, scopeKey],
    );
    // 2) FIFO/LRU 초과분 삭제 (만료 정리 후 남은 row 기준).
    await runner.query(
      `DELETE FROM agent_memory
       WHERE id IN (
         SELECT id FROM agent_memory
         WHERE workspace_id = $1 AND scope_key = $2
         ORDER BY created_at DESC, id DESC
         OFFSET $3
       )`,
      [workspaceId, scopeKey, AGENT_MEMORY_MAX_PER_SCOPE],
    );
  }

  /**
   * 단일 텍스트 임베딩 — KB 경로 (resolveConfig → embed) 재사용.
   * null 반환 시 호출부가 graceful 하게 건너뛴다.
   */
  private async embedOne(
    text: string,
    workspaceId: string,
    embedCfgSource: EmbedConfigSource,
  ): Promise<number[] | null> {
    const model =
      embedCfgSource.embeddingModel?.trim() || DEFAULT_EMBEDDING_MODEL;
    const llmConfig = await this.llmService.resolveConfig(
      embedCfgSource.llmConfigId ?? undefined,
      workspaceId,
    );
    const embeddings = await this.llmService.embed(llmConfig, [text], model);
    const embedding = embeddings[0];
    if (!embedding || embedding.length === 0) {
      this.logger.warn('Agent memory query embedding is empty');
      return null;
    }
    return embedding;
  }
}
