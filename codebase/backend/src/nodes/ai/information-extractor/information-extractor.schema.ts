import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { AI_NO_LLM_PROVIDER_MESSAGE } from '../llm-provider-rule';
import { buildSystemContextSchemaFields } from '../shared/system-context-schema.js';
import { buildConversationContextSchemaFields } from '../shared/conversation-context-schema.js';
import {
  DEFAULT_MEMORY_TOP_K,
  DEFAULT_MEMORY_THRESHOLD,
} from '../ai-agent/ai-agent.schema.js';

const fieldDefSchema = z.object({
  name: z.string().meta({ ui: { label: 'Name', widget: 'text' } }),
  type: z
    .enum(['string', 'number', 'boolean', 'array', 'object'])
    .meta({ ui: { label: 'Type', widget: 'select' } }),
  description: z
    .string()
    .meta({ ui: { label: 'Description', widget: 'textarea' } }),
  required: z
    .boolean()
    .default(true)
    .meta({ ui: { label: 'Required', widget: 'checkbox' } }),
  enumValues: z
    .array(z.string())
    .optional()
    .meta({ ui: { label: 'Enum Values', widget: 'field-array' } }),
});

const exampleDefSchema = z.object({
  input: z.string().meta({ ui: { label: 'Input', widget: 'textarea' } }),
  output: z
    .record(z.string(), z.unknown())
    .meta({ ui: { label: 'Output', widget: 'code', language: 'json' } }),
});

export const informationExtractorNodeConfigSchema = z
  .object({
    llmConfigId: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'LLM Provider',
          widget: 'llm-config-selector',
          order: 1,
        },
      }),
    model: z
      .string()
      .optional()
      .meta({ ui: { label: 'Model', widget: 'text', order: 2 } }),
    inputField: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Input Field',
          widget: 'expression',
          order: 3,
          visibleWhen: { field: 'mode', equals: 'single_turn' },
        },
      }),
    outputSchema: z
      .array(fieldDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Output Schema',
          widget: 'field-array',
          itemLabel: 'Field',
          order: 4,
        },
      }),
    examples: z
      .array(exampleDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Examples',
          widget: 'field-array',
          itemLabel: 'Example',
          order: 5,
        },
      }),
    instructions: z
      .string()
      .optional()
      .meta({ ui: { label: 'Instructions', widget: 'textarea', order: 6 } }),
    mode: z
      .enum(['single_turn', 'multi_turn'])
      .default('single_turn')
      .meta({ ui: { label: 'Mode', widget: 'select', order: 7 } }),
    maxTurns: z
      .number()
      .int()
      .default(10)
      .meta({
        ui: {
          label: 'Max Turns',
          widget: 'number',
          order: 8,
          visibleWhen: { field: 'mode', equals: 'multi_turn' },
        },
      }),
    maxCollectionRetries: z
      .number()
      .int()
      .min(0)
      .default(3)
      .meta({
        ui: {
          label: 'Max Collection Retries',
          widget: 'number',
          order: 9,
          group: 'Retry Settings',
          visibleWhen: { field: 'mode', equals: 'multi_turn' },
          description:
            'How many times to re-prompt the LLM when it reports completion but required fields are still missing. 0 = unlimited.',
        },
      }),
    // ── Conversation Context (auto-injection, spec/4-nodes/3-ai/0-common.md §10) ──
    // Fragment SoT: shared/conversation-context-schema.ts (3 노드 공통 helper).
    // information_extractor 는 `memoryStrategy` 필드를 가지므로(persistent 확장,
    // memory-strategy-extend-ie) ai_agent 와 동일하게 `gateOnManualMemoryStrategy:
    // true` 로 persistent 전략일 때 contextScope 계열 필드를 숨긴다 — manual 일 때만
    // contextScope 가 적용된다 (spec §10·§12.9 직교 축).
    ...buildConversationContextSchemaFields(10, {
      gateOnManualMemoryStrategy: true,
    }),
    // ── Memory (persistent recall + extraction) ──
    // SoT: spec/4-nodes/3-ai/3-information-extractor.md, spec/5-system/17-agent-memory.md.
    // ai_agent 와 동일 의미·라벨·hint 의 부분집합 — `manual`(기본) | `persistent` 만
    // (summary_buffer 는 추출 노드에 무의미하므로 제외; Rationale 참조). manual=기존
    // 동작 100% 유지. persistent=추출 LLM 콜 전 recall 주입 + 턴 경계 비동기 extraction.
    memoryStrategy: z
      .enum(['manual', 'persistent'])
      .default('manual')
      .meta({
        ui: {
          label: 'Memory Strategy',
          widget: 'select',
          order: 11,
          group: 'Memory',
          hint: 'manual = manage context with the fields below. persistent = cross-session recall + extraction.',
          options: [
            {
              value: 'manual',
              label: 'Manual — use Conversation Context fields',
            },
            {
              value: 'persistent',
              label: 'Persistent — cross-session memory recall + extraction',
            },
          ],
        },
      }),
    memoryKey: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Memory Key',
          widget: 'expression',
          order: 12,
          group: 'Memory',
          placeholder: '{{ $input.userId }}',
          hint: 'Persistent memory scope key. Same key recalls the same memory across runs. Empty = isolated per execution.',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),
    memoryTopK: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_MEMORY_TOP_K)
      .meta({
        ui: {
          label: 'Memory Top-K',
          widget: 'number',
          order: 13,
          group: 'Memory',
          hint: 'Number of memory chunks recalled per turn (independent of KB RAG Top-K).',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),
    memoryThreshold: z
      .number()
      .default(DEFAULT_MEMORY_THRESHOLD)
      .meta({
        ui: {
          label: 'Memory Threshold',
          widget: 'number',
          order: 14,
          group: 'Memory',
          hint: 'Minimum similarity (0-1) for memory recall (independent of KB RAG Threshold).',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),
    memoryTtlDays: z
      .number()
      .int()
      .positive()
      .optional()
      .meta({
        ui: {
          label: 'Memory TTL (days)',
          widget: 'number',
          order: 14.5,
          group: 'Memory',
          hint: 'Persistent memories expire after this many days. Empty = never expire.',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),
    embeddingModel: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Embedding Model',
          // NOTE: 'text' (not 'expression') — 의도적. extractionModel 은
          // stateless(매 콜 독립)라 expression 평가가 무해하나, embeddingModel 은
          // scope 의 모든 저장 메모리와 차원이 일치해야 하는 불변식(17-agent-memory §3)
          // 이라 실행마다 동적으로 바뀌면 차원 불일치로 recall 이 조용히 실패한다.
          // 정적 리터럴(text)로 그 footgun 을 차단한다.
          widget: 'text',
          order: 14.6,
          group: 'Memory',
          placeholder: 'text-embedding-3-small',
          hint: 'Embedding model used for memory recall/extraction (must match the dimensions of the model used when memories were first stored). Empty = workspace default LLMConfig embedding model.',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),
    extractionModel: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Extraction Model',
          widget: 'expression',
          order: 14.7,
          group: 'Memory',
          placeholder: 'Leave empty to reuse the node Model',
          hint: 'Optional low-cost model for the turn-boundary memory extraction LLM call. Empty = reuse the node Model (then the provider default).',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),
    // ── System Context Prefix (spec/4-nodes/3-ai/0-common.md §11) ──
    // Fragment SoT: shared/system-context-schema.ts (3 노드 공통 helper).
    ...buildSystemContextSchemaFields(15),
  })
  .passthrough();
export type InformationExtractorConfig = z.infer<
  typeof informationExtractorNodeConfigSchema
>;

/**
 * AUTOCOMPLETE HINT SCHEMA — not used for runtime validation.
 *
 * Runtime `$node["X"]` matches the unified `NodeHandlerOutput` contract
 * (`{ config, output, meta, port, status }`). The LLM-category convention
 * (`output.result.*`) is shared across `ai_agent`, `text_classifier`, and
 * `information_extractor` so downstream expressions like
 * `$node["Extractor"].output.result.extracted.<name>` are uniform.
 *
 * User-defined extraction fields are enriched into `.output.result.extracted`
 * from each node instance's `config.outputSchema` on the frontend (see
 * `enrichInfoExtractorOutputSchema`).
 */
export const informationExtractorNodeOutputSchema = z
  .object({
    config: z
      .object({
        mode: z.enum(['single_turn', 'multi_turn']).optional(),
        model: z.string().optional(),
        schema: z.array(fieldDefSchema).optional(),
        maxTurns: z.number().optional(),
        maxCollectionRetries: z.number().optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    output: z
      .object({
        result: z
          .object({
            extracted: z.record(z.string(), z.unknown()).optional(),
            endReason: z.string().optional(),
            turnCount: z.number().optional(),
            messages: z.array(z.record(z.string(), z.unknown())).optional(),
            originalInput: z.string().optional(),
          })
          .partial()
          .passthrough()
          .optional(),
        error: z
          .object({
            code: z.string(),
            message: z.string(),
            details: z.record(z.string(), z.unknown()).optional(),
          })
          .partial()
          .passthrough()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    meta: z
      .object({
        durationMs: z.number(),
        model: z.string(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        totalTokens: z.number(),
        thinkingTokens: z.number(),
        collectionRetryCount: z.number().optional(),
        turnDebug: z.array(z.record(z.string(), z.unknown())).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    // Waiting shape exposes `status:'waiting_for_input'` alongside the
    // live conversation snapshot. The internal continuation state lives
    // on `_resumeState`. `output.messages` and `output.partial.*` are the
    // canonical runtime fields (CONVENTIONS §4.3); `conversationConfig`
    // is retained for WebSocket event-payload backward compatibility.
    // Expression resolvers intentionally do not surface `_resumeState`.
    status: z.string().optional(),
    port: z.string().optional(),
    interactionType: z.string().optional(),
    conversationConfig: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

export const informationExtractorNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [
    { id: 'out', label: 'Output', type: 'data' },
    { id: 'error', label: 'Error', type: 'error' },
  ],
};

/**
 * Imperative escape hatch — per-field outputSchema validation needs array
 * iteration (each field must have `name` AND `type`), and `maxTurns` ≥ 0
 * combines a numeric type guard with a `< 0` predicate that the mini-DSL
 * can't pair in a single rule. Top-level "no provider?" / "outputSchema
 * empty?" / "single_turn needs inputField?" checks live in `warningRules`.
 */
export function validateInformationExtractorConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];

  const schema = c.outputSchema;
  if (Array.isArray(schema)) {
    for (let i = 0; i < schema.length; i++) {
      const field = (schema[i] ?? {}) as Record<string, unknown>;
      if (!field.name || typeof field.name !== 'string') {
        errors.push(`Field ${i + 1}: name is required`);
      }
      if (!field.type || typeof field.type !== 'string') {
        errors.push(`Field ${i + 1}: type is required`);
      }
    }
  }

  const mode = (c.mode as string) ?? 'single_turn';
  if (mode === 'multi_turn') {
    const maxTurns = c.maxTurns;
    if (
      maxTurns !== undefined &&
      (typeof maxTurns !== 'number' || maxTurns < 0)
    ) {
      errors.push('maxTurns must be 0 (unlimited) or a positive integer');
    }
  }

  return errors;
}

export const informationExtractorNodeMetadata: NodeComponentMetadata = {
  type: 'information_extractor',
  category: 'ai',
  label: 'Information Extractor',
  description: 'Extract structured data from text',
  icon: 'FileSearch',
  color: '#10B981',
  executionMetadata: { kind: 'standard' },
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'info-extractor-mode',
    modeField: 'mode',
    multiTurnValue: 'multi_turn',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `informationExtractorSummary` warnings ("Default provider
  //    not configured" / "Output schema not defined") — provider check
  //    has the same hasDefaultLlmConfig context split as ai_agent (see
  //    that node's note); backend fires whenever both model + llmConfigId
  //    are missing.
  //  - backend handler.validate's "At least one output field is required"
  //    + "inputField is required (single_turn)" rules.
  // Per-field structural validation + maxTurns numeric range live in
  // `validateConfig`.
  warningRules: [
    {
      id: 'information_extractor:no-llm-provider',
      when: '!model && !llmConfigId',
      message: AI_NO_LLM_PROVIDER_MESSAGE,
    },
    {
      id: 'information_extractor:no-output-schema',
      when: 'length(outputSchema) == 0',
      message: 'At least one extraction field must be defined.',
    },
    {
      id: 'information_extractor:single-turn-needs-input-field',
      when: 'mode != multi_turn && !inputField',
      message: 'In Single Turn mode, Input Field must be entered.',
    },
  ],
  validateConfig: validateInformationExtractorConfig,
};
