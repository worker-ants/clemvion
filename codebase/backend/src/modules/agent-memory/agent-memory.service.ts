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
        },
        { removeOnComplete: 100, removeOnFail: 100 },
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
   * 추출된 사실/선호를 임베딩 후 insert + forgetting evict (spec §4, AGM-06).
   * content 임베딩은 EmbeddingService/RagSearch 와 동일한 LlmService.embed 경로를 쓴다.
   * insert 후 (workspace_id, scope_key) 당 AGENT_MEMORY_MAX_PER_SCOPE 초과분을
   * created_at 오래된 순으로 삭제한다. 모든 쿼리는 workspace_id 격리 (§5, AGM-07).
   */
  async saveMemories(
    workspaceId: string,
    scopeKey: string,
    items: MemoryItem[],
    embedCfgSource: EmbedConfigSource,
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

    const values: string[] = [];
    const params: unknown[] = [];
    let paramIdx = 1;
    for (let i = 0; i < valid.length; i++) {
      const item = valid[i];
      const embedding = embeddings[i];
      if (!embedding || embedding.length === 0) {
        throw new Error('Embedding vector is empty');
      }
      const vectorStr = `[${embedding.join(',')}]`;
      values.push(
        `($${paramIdx}, $${paramIdx + 1}, $${paramIdx + 2}, $${paramIdx + 3}::vector, $${paramIdx + 4})`,
      );
      params.push(
        workspaceId,
        scopeKey,
        item.content,
        vectorStr,
        JSON.stringify(item.metadata ?? {}),
      );
      paramIdx += 5;
    }

    await this.dataSource.query(
      `INSERT INTO agent_memory (workspace_id, scope_key, content, embedding, metadata)
       VALUES ${values.join(', ')}`,
      params,
    );

    await this.evictOldest(workspaceId, scopeKey);
  }

  /**
   * forgetting evict (spec §4): (workspace_id, scope_key) 당 최신 N=AGENT_MEMORY_MAX_PER_SCOPE
   * 건만 보존. 초과 시 created_at 오래된 순 (동률은 id) 으로 삭제. ConversationThread 의
   * STORAGE_MAX_TURNS evict 와 동형. workspace_id 격리 강제.
   */
  private async evictOldest(
    workspaceId: string,
    scopeKey: string,
  ): Promise<void> {
    await this.dataSource.query(
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
