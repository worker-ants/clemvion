/**
 * AI 노드 Memory config zod schema fragment 공통 헬퍼.
 *
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §1·§6.1 · spec/4-nodes/3-ai/3-information-extractor.md
 *      · spec/5-system/17-agent-memory.md.
 *
 * AI Agent / Information Extractor 두 노드가 동일 의미·라벨·hint 의 메모리 config
 * 필드(`memoryKey`/`memoryTopK`/`memoryThreshold`/`memoryTtlDays`/`embeddingModel`/
 * `extractionModel` + `memoryStrategy`)를 갖는다. 본 헬퍼가 라벨·hint·default·
 * visibleWhen 의 단일 진실이다 (`buildConversationContextSchemaFields` 패턴).
 *
 * 노드별 차이는 opts 로 제어한다:
 *  - `memoryStrategy` enum·options·hint·order 는 노드별 다르다 (ai_agent:
 *    manual|summary_buffer|persistent, IE: manual|persistent) → `strategy` opt.
 *  - 각 필드의 UI `order` 는 노드별로 다르므로 `orders` 로 명시 주입한다
 *    (ai_agent 44~49.7, IE 11~14.7 — 단순 orderStart+N 패턴이 아님).
 *  - `memoryTokenBudget` / `summaryModel` 는 **ai_agent 전용** (summary_buffer
 *    경로) → 각 order 가 주어질 때만 방출한다 (`tokenBudgetOrder`/`summaryModelOrder`).
 *
 * 방출되는 필드 객체의 키 순서·meta 내용은 종전 인라인 정의와 100% 동일하다
 * (ui-label-parity·노드 schema 테스트 회귀 0).
 */

import { z } from 'zod';

const GROUP = 'Memory';

/** `memoryTokenBudget` 기본값 — working-memory 토큰 예산 (spec §1). */
export const DEFAULT_MEMORY_TOKEN_BUDGET = 8000;
/** `memoryTopK` 기본값 — persistent 회수 top-k (KB `ragTopK` 와 독립). */
export const DEFAULT_MEMORY_TOP_K = 5;
/** `memoryThreshold` 기본값 — persistent 회수 최소 유사도 (KB `ragThreshold` 와 독립). */
export const DEFAULT_MEMORY_THRESHOLD = 0.7;

export interface MemoryStrategyOption {
  value: string;
  label: string;
}

export interface BuildAgentMemorySchemaFieldsOptions {
  /** `memoryStrategy` 필드 설정 (노드별 enum·options·hint·order 가 다름). */
  strategy: {
    /** enum 값 (ai_agent: 3, IE: 2). 첫 값이 default(`manual`). */
    values: readonly [string, ...string[]];
    /** UI order. */
    order: number;
    /** select hint. */
    hint: string;
    /** select options. */
    options: MemoryStrategyOption[];
  };
  /** 공통 메모리 필드의 UI order (노드별 다름 — 명시 주입). */
  orders: {
    memoryKey: number;
    memoryTopK: number;
    memoryThreshold: number;
    memoryTtlDays: number;
    embeddingModel: number;
    extractionModel: number;
  };
  /**
   * 주어지면 `memoryTokenBudget` 필드를 이 order 로 방출한다 (ai_agent 전용 —
   * summary_buffer working-memory 예산). undefined 면 방출 안 함 (IE).
   */
  tokenBudgetOrder?: number;
  /**
   * 주어지면 `summaryModel` 필드를 이 order 로 방출한다 (ai_agent 전용 — 요약
   * LLM 콜 모델). undefined 면 방출 안 함 (IE).
   */
  summaryModelOrder?: number;
}

/**
 * AI Agent / Information Extractor schema 의 Memory 필드 fragment 를 생성한다.
 *
 * 반환 객체의 spread 순서가 곧 필드 선언 순서이므로, 종전 인라인 정의의 순서
 * (memoryStrategy → [memoryTokenBudget] → memoryKey → memoryTopK →
 * memoryThreshold → memoryTtlDays → embeddingModel → [summaryModel] →
 * extractionModel) 를 그대로 보존한다.
 */
export function buildAgentMemorySchemaFields(
  opts: BuildAgentMemorySchemaFieldsOptions,
) {
  const { strategy, orders } = opts;

  const fields: Record<string, z.ZodTypeAny> = {};

  fields.memoryStrategy = z
    .enum(strategy.values)
    .default('manual')
    .meta({
      ui: {
        label: 'Memory Strategy',
        widget: 'select',
        order: strategy.order,
        group: GROUP,
        hint: strategy.hint,
        options: strategy.options,
      },
    });

  if (opts.tokenBudgetOrder !== undefined) {
    fields.memoryTokenBudget = z
      .number()
      .int()
      .positive()
      .default(DEFAULT_MEMORY_TOKEN_BUDGET)
      .meta({
        ui: {
          label: 'Token Budget',
          widget: 'number',
          order: opts.tokenBudgetOrder,
          group: GROUP,
          hint: 'Working-memory token budget. Older turns are rolled into a summary once exceeded.',
          // 단일-필드 평가기라 복합 AND 불가 — summary_buffer/persistent 둘 다
          // 노출해야 하므로 oneOf 화이트리스트 사용.
          visibleWhen: {
            field: 'memoryStrategy',
            oneOf: ['summary_buffer', 'persistent'],
          },
        },
      });
  }

  fields.memoryKey = z
    .string()
    .optional()
    .meta({
      ui: {
        label: 'Memory Key',
        widget: 'expression',
        order: orders.memoryKey,
        group: GROUP,
        placeholder: '{{ $input.userId }}',
        hint: 'Persistent memory scope key. Same key recalls the same memory across runs. Empty = isolated per execution.',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  fields.memoryTopK = z
    .number()
    .int()
    .positive()
    .default(DEFAULT_MEMORY_TOP_K)
    .meta({
      ui: {
        label: 'Memory Top-K',
        widget: 'number',
        order: orders.memoryTopK,
        group: GROUP,
        hint: 'Number of memory chunks recalled per turn (independent of KB RAG Top-K).',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  fields.memoryThreshold = z
    .number()
    .default(DEFAULT_MEMORY_THRESHOLD)
    .meta({
      ui: {
        label: 'Memory Threshold',
        widget: 'number',
        order: orders.memoryThreshold,
        group: GROUP,
        hint: 'Minimum similarity (0-1) for memory recall (independent of KB RAG Threshold).',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  fields.memoryTtlDays = z
    .number()
    .int()
    .positive()
    .optional()
    .meta({
      ui: {
        label: 'Memory TTL (days)',
        widget: 'number',
        order: orders.memoryTtlDays,
        group: GROUP,
        hint: 'Persistent memories expire after this many days. Empty = never expire.',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  fields.embeddingModel = z
    .string()
    .optional()
    .meta({
      ui: {
        label: 'Embedding Model',
        // NOTE: 'text' (not 'expression') — 의도적. summaryModel/extractionModel
        // 은 stateless(매 콜 독립)라 expression 평가가 무해하나, embeddingModel 은
        // scope 의 모든 저장 메모리와 차원이 일치해야 하는 불변식(17-agent-memory §3)
        // 이라 실행마다 동적으로 바뀌면 차원 불일치로 recall 이 조용히 실패한다.
        // 정적 리터럴(text)로 그 footgun 을 차단한다.
        widget: 'text',
        order: orders.embeddingModel,
        group: GROUP,
        placeholder: 'text-embedding-3-small',
        hint: 'Embedding model used for memory recall/extraction (must match the dimensions of the model used when memories were first stored). Empty = workspace default LLMConfig embedding model.',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  if (opts.summaryModelOrder !== undefined) {
    // SoT: spec/4-nodes/3-ai/1-ai-agent.md §1·§6.1·§12.12. 요약/추출 LLM 콜에
    // 쓸 전용 모델 ID (expression). 미설정 시 노드 `model` → llmConfig 기본으로
    // 폴백 (fallback 체인 `[전용] → [model] → [llmConfig 기본]`, 기존 동작 유지).
    // `summaryModel` 은 summary_buffer/persistent 둘 다, `extractionModel` 은
    // persistent 에서만 의미 (요약/추출 분기 — §2 visibleWhen).
    fields.summaryModel = z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Summary Model',
          widget: 'expression',
          order: opts.summaryModelOrder,
          group: GROUP,
          placeholder: 'Leave empty to reuse the node Model',
          hint: 'Optional low-cost model for the rolling-summary LLM call. Empty = reuse the node Model (then the provider default).',
          visibleWhen: {
            field: 'memoryStrategy',
            oneOf: ['summary_buffer', 'persistent'],
          },
        },
      });
  }

  fields.extractionModel = z
    .string()
    .optional()
    .meta({
      ui: {
        label: 'Extraction Model',
        widget: 'expression',
        order: orders.extractionModel,
        group: GROUP,
        placeholder: 'Leave empty to reuse the node Model',
        hint: 'Optional low-cost model for the turn-boundary memory extraction LLM call. Empty = reuse the node Model (then the provider default).',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  return fields;
}
