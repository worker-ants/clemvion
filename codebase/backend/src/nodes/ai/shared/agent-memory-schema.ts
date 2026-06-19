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

  fields.embeddingModelConfigId = z
    .string()
    .optional()
    .meta({
      ui: {
        // 등록된 embedding ModelConfig(kind=embedding) 를 고른다 — 저장값은 config.id.
        // 서버가 그 config 의 defaultModel·provider 로 임베딩한다(KB embeddingModelConfigId
        // 패턴 미러). 회수·저장이 같은 config 라 차원이 일치한다(17-agent-memory §3).
        // 미설정 시 워크스페이스 기본 embedding ModelConfig.
        label: 'Embedding Model',
        widget: 'embedding-config-selector',
        order: orders.embeddingModel,
        group: GROUP,
        hint: 'Registered embedding model config used for memory recall/extraction (its provider/model). Recall and storage use the same config so dimensions match. Empty = workspace default embedding config.',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  if (opts.summaryModelOrder !== undefined) {
    // SoT: spec/4-nodes/3-ai/1-ai-agent.md §1·§6.1·§12.12. 요약/추출 보조 LLM 콜에
    // 쓸 **등록 chat ModelConfig** id 를 고른다(저장값 config.id, widget
    // `chat-config-selector`). 서버가 그 config 의 provider/credential/defaultModel 로
    // 호출한다 — 노드 main `llmConfigId` 와 분리되어 다른(저렴한) provider 의 모델도
    // 쓸 수 있다(§12.12 재번복). 미설정 시 노드 model → llmConfig 기본 폴백(기존 동작
    // 유지). `summaryModelConfigId` 는 summary_buffer/persistent 둘 다, `extractionModelConfigId`
    // 는 persistent 에서만 의미.
    fields.summaryModelConfigId = z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Summary Model',
          widget: 'chat-config-selector',
          order: opts.summaryModelOrder,
          group: GROUP,
          hint: 'Optional registered chat model config for the rolling-summary LLM call (a cheaper one cuts cost). Empty = reuse the node Model.',
          visibleWhen: {
            field: 'memoryStrategy',
            oneOf: ['summary_buffer', 'persistent'],
          },
        },
      });
  }

  fields.extractionModelConfigId = z
    .string()
    .optional()
    .meta({
      ui: {
        label: 'Extraction Model',
        widget: 'chat-config-selector',
        order: orders.extractionModel,
        group: GROUP,
        hint: 'Optional registered chat model config for the turn-boundary memory extraction LLM call (a cheaper one cuts cost). Empty = reuse the node Model.',
        visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
      },
    });

  return fields;
}
