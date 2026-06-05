import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { AI_NO_LLM_PROVIDER_MESSAGE } from '../llm-provider-rule';
import { buildSystemContextSchemaFields } from '../shared/system-context-schema.js';
import {
  buildConversationContextSchemaFields,
  DEFAULT_CONTEXT_SCOPE_N as SHARED_DEFAULT_CONTEXT_SCOPE_N,
} from '../shared/conversation-context-schema.js';
import { PRESENTATION_TYPES } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * Default for `contextScopeN` — the number of most recent ConversationThread
 * turns to inject when `contextScope: 'lastN'`. Single source of truth used
 * by both the schema default and the handler's runtime fallback so they can't
 * drift out of sync (ai-review W#13).
 *
 * 정의는 3 노드 공통 fragment (`shared/conversation-context-schema.ts`) 로 이전됐고,
 * 본 export 는 하위호환 re-export 다.
 */
export const DEFAULT_CONTEXT_SCOPE_N = SHARED_DEFAULT_CONTEXT_SCOPE_N;

/**
 * AI Agent 의 대화 컨텍스트 메모리 관리 전략 (spec/4-nodes/3-ai/1-ai-agent.md §1,
 * §12.9). `contextScope` (범위 축) 와 직교하는 관리 축의 1급 enum.
 *
 * - `manual` (기본): 기존 contextScope 계열 5필드 동작 그대로 (하위호환 0 리스크).
 * - `summary_buffer`: 단일 실행 내 토큰예산 롤링 요약 압축.
 * - `persistent`: summary_buffer working-memory + 세션 간 추출 메모리 의미검색 회수.
 *
 * NOTE: `manual` 단어가 `Trigger.type: 'manual'` 과 표면상 겹치지만 namespace
 * (`MemoryStrategy` vs `Trigger.type`) 가 다르다 — 의미 명료성을 우선해 **별도
 * 타입으로 선언** 한다 (Trigger.type 재사용 금지, spec §12.9 결정).
 */
export const MEMORY_STRATEGIES = [
  'manual',
  'summary_buffer',
  'persistent',
] as const;
export type MemoryStrategy = (typeof MEMORY_STRATEGIES)[number];

/** `memoryTokenBudget` 기본값 — working-memory 토큰 예산 (spec §1). */
export const DEFAULT_MEMORY_TOKEN_BUDGET = 8000;
/** `memoryTopK` 기본값 — persistent 회수 top-k (KB `ragTopK` 와 독립). */
export const DEFAULT_MEMORY_TOP_K = 5;
/** `memoryThreshold` 기본값 — persistent 회수 최소 유사도 (KB `ragThreshold` 와 독립). */
export const DEFAULT_MEMORY_THRESHOLD = 0.7;

const mcpServerRefSchema = z.object({
  integrationId: z
    .string()
    .min(1)
    .meta({ ui: { label: 'Integration ID', widget: 'text', hidden: true } }),
  enabledTools: z
    .array(z.string())
    .optional()
    .meta({
      ui: {
        label: 'Enabled Tools',
        widget: 'field-array',
        hint: "Leave empty to expose all of the server's regular tools to the LLM.",
      },
    }),
  includeResources: z
    .boolean()
    .default(true)
    .meta({
      ui: {
        label: 'Expose Resources',
        widget: 'checkbox',
        hint: 'Expose list/read meta-tools when the server reports resources capability',
      },
    }),
  includePrompts: z
    .boolean()
    .default(true)
    .meta({
      ui: {
        label: 'Expose Prompts',
        widget: 'checkbox',
        hint: 'Expose list/get meta-tools when the server reports prompts capability',
      },
    }),
  toolOverrides: z
    .array(
      z.object({
        toolName: z.string(),
        description: z.string().optional(),
      }),
    )
    .optional(),
});

/**
 * Presentation tool family (`render_*`) — AI Agent 가 LLM 응답 surface 를
 * 텍스트에서 5종 (table·chart·carousel·template·form) 가상 도구로 확장.
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §1·§4.1, spec/4-nodes/6-presentation/0-common.md §10.
 *
 * 비어 있으면 OFF (기본). 한 노드 안에서 `type` 중복 금지 — validateAiAgentConfig 가 검증.
 *
 * type enum 의 단일 진실은 `shared/conversation-thread/conversation-thread.types.ts`
 * 의 `PRESENTATION_TYPES` 상수. 신규 type 추가 시 본 파일 수정 불필요.
 */
const presentationToolDefSchema = z.object({
  // `.default(첫 enum)` — frontend field-array 의 "행 추가" 위젯이 새 행을 만들 때,
  // native `<select>` 는 첫 옵션을 시각적으로 보여주지만 사용자가 드롭다운을 건드리지
  // 않으면 onChange 가 발화되지 않아 `type` 이 폼 상태에 안 들어가 `{}` 로 저장된다
  // (런타임 `RenderToolProvider: Skipping ... type: undefined` 의 근본 원인).
  // JSON Schema 에 `default` 를 노출해 frontend `buildNewItem` 이 새 행을 첫 옵션으로
  // 미리 채우게 하고, parse 시 absent→첫 옵션으로 보정한다. `PRESENTATION_TYPES[0]` 을
  // 써서 enum 변경에 drift-free (line 71 주석 참조).
  type: z
    .enum(PRESENTATION_TYPES)
    .default(PRESENTATION_TYPES[0])
    .meta({
      ui: { label: 'Type', widget: 'select' },
    }),
  description: z
    .string()
    .optional()
    .meta({
      ui: {
        label: 'Description override',
        widget: 'text',
        hint: 'Override the default LLM-facing description for this tool',
      },
    }),
  defaults: z
    .record(z.string(), z.unknown())
    .optional()
    .meta({
      ui: {
        label: 'Defaults overlay',
        widget: 'json',
        hint: 'Brand/style fixed values that override LLM payload on deep-merge',
      },
    }),
});
export type PresentationToolDef = z.infer<typeof presentationToolDefSchema>;

const conditionDefSchema = z.object({
  id: z.string().meta({ ui: { label: 'ID', widget: 'text', hidden: true } }),
  label: z
    .string()
    .default('')
    .meta({
      ui: {
        label: 'Label',
        widget: 'text',
        placeholder: 'Label (e.g. Refund Request)',
      },
    }),
  prompt: z
    .string()
    .default('')
    .meta({
      ui: {
        label: 'Prompt',
        widget: 'text',
        placeholder: 'Prompt (when to trigger this condition)',
      },
    }),
});

export const aiAgentNodeConfigSchema = z
  .object({
    mode: z
      .enum(['single_turn', 'multi_turn'])
      .default('single_turn')
      .meta({
        ui: {
          label: 'Mode',
          widget: 'select',
          order: 0,
          // userPrompt 는 single_turn 전용 필드. mode 가 multi_turn 으로 바뀌면
          // visibleWhen 으로 화면에서만 사라지고 config 값은 leak 되어 backend
          // 가 의도치 않은 첫 LLM 호출을 trigger 한다 — frontend auto-form 의
          // applyClearFields 로 mode 변경 시 userPrompt 키를 자동 제거한다.
          clearFields: ['userPrompt'],
          options: [
            { value: 'single_turn', label: 'Single Turn' },
            { value: 'multi_turn', label: 'Multi Turn (Conversation)' },
          ],
        },
      }),
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
      .meta({
        ui: {
          label: 'Model Override',
          widget: 'expression',
          placeholder: 'Leave empty for provider default',
          order: 2,
        },
      }),
    systemPrompt: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'System Prompt',
          widget: 'expression',
          placeholder: 'You are a helpful assistant...',
          hint: 'Supports markdown and expressions',
          multiline: true,
          rows: 6,
          order: 3,
        },
      }),
    userPrompt: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'User Prompt',
          widget: 'expression',
          placeholder: '{{ $input.question }}',
          hint: 'Expression to build the user message',
          order: 4,
          visibleWhen: { field: 'mode', notEquals: 'multi_turn' },
        },
      }),
    responseFormat: z
      .enum(['text', 'json'])
      .default('text')
      .meta({ ui: { label: 'Response Format', widget: 'select', order: 5 } }),
    jsonSchema: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({
        ui: {
          label: 'JSON Schema',
          widget: 'code',
          language: 'json',
          placeholder: '{"type": "object", "properties": {...}}',
          order: 6,
          visibleWhen: { field: 'responseFormat', equals: 'json' },
        },
      }),

    // ── Knowledge Base (RAG) ──
    // 선택한 KB 들은 LLM 에 `kb_<name>` tool 로 노출되어 LLM 이 능동적으로 검색을
    // 호출한다. 다중 의도 메시지에서는 LLM 이 같은 응답에 여러 kb_* tool 을 동시
    // 호출해 병렬 검색하며, 결과가 부족하면 다른 query 로 재호출한다.
    knowledgeBases: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'Knowledge Bases',
          widget: 'kb-selector',
          hint: 'Selected KBs are exposed to the LLM as search tools. The LLM calls them autonomously based on user intent.',
          order: 10,
          group: 'Knowledge Base (RAG)',
        },
      }),
    ragTopK: z
      .number()
      .int()
      .default(5)
      .meta({
        ui: {
          label: 'RAG Top-K (default)',
          widget: 'number',
          hint: 'Default chunk count returned per KB tool call (LLM can override via call arguments)',
          order: 11,
          group: 'Knowledge Base (RAG)',
        },
      }),
    ragThreshold: z
      .number()
      .default(0.7)
      .meta({
        ui: {
          label: 'RAG Threshold (default)',
          widget: 'number',
          hint: 'Default minimum similarity threshold (0-1) (LLM can override via call arguments)',
          order: 12,
          group: 'Knowledge Base (RAG)',
        },
      }),

    // ── MCP Servers ──
    // Workspace 에 등록된 service_type='mcp' Integration 을 참조해 서버의 도구·
    // resource·prompt 를 LLM 에 노출한다. 서버 단위 on/off + 도구별 allowlist.
    // 상세: spec/5-system/11-mcp-client.md.
    mcpServers: z
      .array(mcpServerRefSchema)
      .default([])
      .meta({
        ui: {
          label: 'MCP Servers',
          widget: 'mcp-server-selector',
          itemLabel: 'MCP Server',
          hint: 'Add a workspace-registered MCP server to let the LLM autonomously call its tools.',
          order: 15,
          group: 'MCP Servers',
        },
      }),

    // ── Conditions ──
    conditions: z
      .array(conditionDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Conditions',
          widget: 'field-array',
          itemLabel: 'Condition',
          order: 20,
          group: 'Conditions',
        },
      }),

    // ── Presentation Tools (`render_*`) ──
    // SoT: spec/4-nodes/3-ai/1-ai-agent.md §1, §4.1
    //      spec/4-nodes/6-presentation/0-common.md §10
    // Empty array = OFF (default). Each tool registered exposes a `render_<type>`
    // virtual tool to the LLM. Schema/cap/defaults overlay rules in presentation
    // common §10. Duplicate type within a node is rejected by validateAiAgentConfig.
    presentationTools: z
      .array(presentationToolDefSchema)
      .default([])
      .meta({
        ui: {
          label: 'Presentation Tools',
          widget: 'field-array',
          itemLabel: 'Tool',
          order: 25,
          group: 'Presentation Tools',
          hint: 'Let the LLM render tables / charts / carousels / templates / forms in chat by calling render_* tools.',
        },
      }),

    // ── Advanced ──
    temperature: z
      .number()
      .optional()
      .meta({
        ui: {
          label: 'Temperature',
          widget: 'number',
          hint: '0 = deterministic, 2 = creative',
          order: 30,
          group: 'Advanced',
        },
      }),
    maxTokens: z
      .number()
      .int()
      .optional()
      .meta({
        ui: {
          label: 'Max Tokens',
          widget: 'number',
          order: 31,
          group: 'Advanced',
        },
      }),
    maxToolCalls: z
      .number()
      .int()
      .default(10)
      .meta({
        ui: {
          label: 'Max Tool Calls',
          widget: 'number',
          order: 32,
          group: 'Advanced',
        },
      }),
    // 도구 연결 입력 경로 — 재작성 예정으로 스키마에서 제거.
    // 스키마는 .passthrough() 이므로 DB 의 기존 toolNodeIds / toolOverrides
    // 값은 silently 통과한다 (핸들러가 읽지 않으므로 결과적으로 무시됨).
    // 재작성 시 새 입력 경로 디자인에 따라 신규 필드를 추가.
    // 자세한 사유·복원 절차는 plan/in-progress/ai-agent-tool-connection-rewrite.md.
    // `conversationHistory` / `historyCount` 는 제거됨 — `contextScope` /
    // `contextScopeN` 로 완전 대체 (spec/conventions/conversation-thread.md §5).
    // 스키마가 `.passthrough()` 이므로 DB legacy 값은 silently 통과.

    // ── Conversation Context (auto-injection from ConversationThread) ──
    // SoT: spec/conventions/conversation-thread.md §5
    //      spec/4-nodes/3-ai/0-common.md §10
    // Fragment SoT: shared/conversation-context-schema.ts (3 노드 공통 helper).
    // AI Agent 는 `memoryStrategy` 필드를 가지므로 `gateOnManualMemoryStrategy:
    // true` 로 자동 전략 시 contextScope 계열 필드를 숨긴다 (order 37-41, 종전
    // 정의와 100% 동치 — visibleWhen/options/hint 모두 보존).
    ...buildConversationContextSchemaFields(37, {
      gateOnManualMemoryStrategy: true,
    }),

    // ── System Context Prefix ──
    // SoT: spec/4-nodes/3-ai/0-common.md §11. Default true 로 시각·timezone 한 줄
    // prefix 가 systemPrompt 앞에 자동 prepend. Cafe24 MCP 도구 description 의 KST
    // suffix 와 두 채널로 LLM 시각 추론 회귀를 차단.
    // Fragment SoT: shared/system-context-schema.ts (3 노드 공통 helper).
    ...buildSystemContextSchemaFields(42),

    // ── Memory ──
    // SoT: spec/4-nodes/3-ai/1-ai-agent.md §1·§6.1, spec/5-system/17-agent-memory.md.
    // 메모리 관리 전략 (관리 축) — contextScope (범위 축) 와 직교 (§12.9).
    // `manual` (기본) 이면 위 Conversation Context 5필드가 그대로 적용되고,
    // `summary_buffer` / `persistent` 면 자동 전략이 그 5필드를 대체한다 (§1 비고).
    // order 44-48 — System Context (42-43) 뒤, Multi Turn (50) 앞. 한 그룹으로
    // 연속 배치해 frontend SchemaForm.groupEntries 가 쪼개지 않게 한다.
    memoryStrategy: z
      .enum(MEMORY_STRATEGIES)
      .default('manual')
      .meta({
        ui: {
          label: 'Memory Strategy',
          widget: 'select',
          order: 44,
          group: 'Memory',
          hint: 'manual = manage context with the fields below. summary_buffer = rolling token-budget summary. persistent = summary buffer + cross-session recall.',
          options: [
            {
              value: 'manual',
              label: 'Manual — use Conversation Context fields',
            },
            {
              value: 'summary_buffer',
              label: 'Summary Buffer — rolling token-budget summary',
            },
            {
              value: 'persistent',
              label: 'Persistent — summary buffer + cross-session memory',
            },
          ],
        },
      }),
    memoryTokenBudget: z
      .number()
      .int()
      .positive()
      .default(DEFAULT_MEMORY_TOKEN_BUDGET)
      .meta({
        ui: {
          label: 'Token Budget',
          widget: 'number',
          order: 45,
          group: 'Memory',
          hint: 'Working-memory token budget. Older turns are rolled into a summary once exceeded.',
          // 단일-필드 평가기라 복합 AND 불가 — summary_buffer/persistent 둘 다
          // 노출해야 하므로 oneOf 화이트리스트 사용.
          visibleWhen: {
            field: 'memoryStrategy',
            oneOf: ['summary_buffer', 'persistent'],
          },
        },
      }),
    memoryKey: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Memory Key',
          widget: 'expression',
          order: 46,
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
          order: 47,
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
          order: 48,
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
          order: 49,
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
          widget: 'text',
          order: 49.5,
          group: 'Memory',
          placeholder: 'text-embedding-3-small',
          hint: 'Embedding model used for memory recall/extraction (must match the dimensions of the model used when memories were first stored). Empty = workspace default LLMConfig embedding model.',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),
    // SoT: spec/4-nodes/3-ai/1-ai-agent.md §1·§6.1·§12.12. 요약/추출 LLM 콜에
    // 쓸 전용 모델 ID (expression). 미설정 시 노드 `model` → llmConfig 기본으로
    // 폴백 (fallback 체인 `[전용] → [model] → [llmConfig 기본]`, 기존 동작 유지).
    // `summaryModel` 은 summary_buffer/persistent 둘 다, `extractionModel` 은
    // persistent 에서만 의미 (요약/추출 분기 — §2 visibleWhen).
    summaryModel: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Summary Model',
          widget: 'expression',
          order: 49.6,
          group: 'Memory',
          placeholder: 'Leave empty to reuse the node Model',
          hint: 'Optional low-cost model for the rolling-summary LLM call. Empty = reuse the node Model (then the provider default).',
          visibleWhen: {
            field: 'memoryStrategy',
            oneOf: ['summary_buffer', 'persistent'],
          },
        },
      }),
    extractionModel: z
      .string()
      .optional()
      .meta({
        ui: {
          label: 'Extraction Model',
          widget: 'expression',
          order: 49.7,
          group: 'Memory',
          placeholder: 'Leave empty to reuse the node Model',
          hint: 'Optional low-cost model for the turn-boundary memory extraction LLM call. Empty = reuse the node Model (then the provider default).',
          visibleWhen: { field: 'memoryStrategy', equals: 'persistent' },
        },
      }),

    // ── Multi Turn Settings ──
    maxTurns: z
      .number()
      .int()
      .default(20)
      .meta({
        ui: {
          label: 'Max Turns',
          widget: 'number',
          hint: '0 = unlimited',
          // order 50 — Conversation Context (37-41) + System Context (42-43)
          // 다음. order 40 으로 두면 frontend SchemaForm.groupEntries (연속
          // 항목만 묶는다) 가 Conversation Context 그룹을 maxTurns 앞뒤로
          // 쪼개 같은 React key ('Conversation Context') 가 두 번 생긴다.
          order: 50,
          group: 'Multi Turn Settings',
          visibleWhen: { field: 'mode', equals: 'multi_turn' },
        },
      }),
  })
  .passthrough();
export type AiAgentConfig = z.infer<typeof aiAgentNodeConfigSchema>;

/**
 * AUTOCOMPLETE HINT SCHEMA — not used for runtime validation.
 *
 * Serialised via `z.toJSONSchema()` and sent to the frontend where it drives
 * `$node["X"].output.<field>` suggestions. The AI Agent handler returns the
 * canonical 5-field NodeHandlerOutput (`config`/`output`/`meta`/`port`/
 * `status`) per CONVENTIONS Principle 0; this schema describes the inner
 * `output` namespace and is a superset of every mode's shape:
 *
 *  - Single-turn `out` / multi-turn ended / condition / error → `output.result.*`
 *  - Single-turn / multi-turn `error` → `output.error.*`
 *  - Multi-turn waiting / resumed → `output.result.*` (messages/message/turnCount)
 *    + `output.interaction?` (resumed only). D6 (2026-05-17) — waiting 시점
 *    의 `messages` / `message` / `turnCount` 가 종결 시점과 단일 경로
 *    (`output.result.*`) 로 통일. `maxTurns` 는 config 전용 (Principle 1.1).
 *
 * Intentionally permissive (`.passthrough()` + `.optional()`) — we only need
 * to enumerate stable keys for autocomplete, not reject runtime data.
 * Top-level engine wrapper keys (`config`/`meta`/`port`/`status`) are exposed
 * by the engine through `$node["X"].config` / `.meta` / etc., not via this
 * schema.
 */
export const aiAgentNodeOutputSchema = z
  .object({
    // Terminal results live under `output.result.*` (single-turn `out`,
    // multi-turn ended/condition). D6 (2026-05-17) — waiting/resumed
    // 시점의 `messages` / `message` / `turnCount` 도 동일 경로
    // (`output.result.*`) 로 통일되어 schema 가 종결/대기 양쪽을 단일
    // 형태로 표현한다. `maxTurns` 는 config 전용 — output 에 두지 않는다
    // (Principle 1.1).
    result: z
      .object({
        response: z.unknown(),
        endReason: z.string(),
        turnCount: z.number(),
        messages: z.array(z.unknown()),
        // D6 — waiting/resumed 전용 라이브 스냅샷 필드.
        message: z.string(),
        condition: z
          .object({
            id: z.string(),
            label: z.string(),
            reason: z.string(),
          })
          .partial()
          .optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    // Error results live under `output.error.*` (Principle 11 LLM wrapper).
    error: z
      .object({
        code: z.string(),
        message: z.string(),
        details: z.record(z.string(), z.unknown()).optional(),
      })
      .partial()
      .passthrough()
      .optional(),
    // Multi-turn `resumed` snapshots carry the user interaction payload
    // under `output.interaction`. D6 — `messages` / `message` /
    // `turnCount` 의 top-level slot 폐기, `output.result.*` 로 이동
    // (위 참조). `maxTurns` 는 config 전용 (Principle 1.1).
    interaction: z
      .object({
        type: z.string(),
        data: z.record(z.string(), z.unknown()),
        receivedAt: z.string(),
      })
      .partial()
      .passthrough()
      .optional(),
  })
  .passthrough();

export const aiAgentNodePorts: NodePorts = {
  inputs: [{ id: 'in', label: 'Input', type: 'data' }],
  outputs: [{ id: 'out', label: 'Output', type: 'data' }],
};

/**
 * Imperative escape hatch — per-condition validation needs array iteration
 * + reserved-port-id whitelist + 2000-char prompt cap. `maxTurns` ≥ 0 needs
 * a numeric type guard combined with `< 0` that the mini-DSL can't pair
 * with "only when mode=multi_turn" cleanly. Single-field "missing model" /
 * "missing systemPrompt for multi-turn" / "too many conditions" checks live
 * in `warningRules` below so the canvas badge fires.
 *
 * NOTE: the frontend `aiAgentSummary` warning ("Default provider not
 * configured") relies on an external `hasDefaultLlmConfig` context flag —
 * the canvas suppresses the warning when a workspace-default LLM exists.
 * Backend `warningRules` cannot read that context, so the equivalent
 * declarative rule fires whenever BOTH `model` and `llmConfigId` are
 * missing. The frontend will continue to suppress the canvas badge using
 * its context-aware formatter — no double-fire.
 */
const RESERVED_PORT_IDS = new Set([
  'out',
  'in',
  'error',
  'user_ended',
  'max_turns',
]);
/**
 * Per-tool `defaults` overlay 의 바이트 cap (ai-review SUMMARY #6 — security).
 * 최종 merged payload 의 1MB cap (`PRESENTATION_MAX_BYTES`) 와는 별개의
 * 사용자-config 차원 사전 게이트. brand/style 고정값은 일반적으로 수 KB 를
 * 넘지 않으므로 256KB 면 충분히 여유 있다.
 */
export const PRESENTATION_DEFAULTS_MAX_BYTES = 256 * 1024;

export function validateAiAgentConfig(config: unknown): string[] {
  const c = (config ?? {}) as Record<string, unknown>;
  const errors: string[] = [];
  const mode = ((c.mode as string) ?? 'single_turn') as
    | 'single_turn'
    | 'multi_turn';

  if (mode === 'multi_turn') {
    const maxTurns = c.maxTurns;
    if (
      maxTurns !== undefined &&
      (typeof maxTurns !== 'number' || maxTurns < 0)
    ) {
      errors.push('maxTurns must be 0 (unlimited) or a positive integer');
    }
  }

  const conditions = c.conditions;
  if (Array.isArray(conditions)) {
    for (let i = 0; i < conditions.length; i++) {
      const cond = (conditions[i] ?? {}) as Record<string, unknown>;
      if (!cond.id || typeof cond.id !== 'string') {
        errors.push(`conditions[${i}]: id is required`);
      } else if (RESERVED_PORT_IDS.has(cond.id)) {
        errors.push(
          `conditions[${i}]: id '${cond.id}' conflicts with reserved port name`,
        );
      }
      if (!cond.label || typeof cond.label !== 'string') {
        errors.push(`conditions[${i}]: label is required`);
      }
      if (!cond.prompt || typeof cond.prompt !== 'string') {
        errors.push(`conditions[${i}]: prompt is required`);
      } else if (cond.prompt.length > 2000) {
        errors.push(`conditions[${i}]: prompt must be 2000 characters or less`);
      }
    }
  }

  // Presentation tools — one type per node (spec/4-nodes/3-ai/1-ai-agent.md §1).
  const presentationTools = c.presentationTools;
  if (Array.isArray(presentationTools)) {
    const seen = new Set<string>();
    for (let i = 0; i < presentationTools.length; i++) {
      const tool = presentationTools[i];
      const t = (tool ?? {}) as Record<string, unknown>;
      const type = typeof t.type === 'string' ? t.type : '';
      if (!type) continue; // zod-level error path
      if (seen.has(type)) {
        errors.push(
          `presentationTools: duplicate type '${type}' — each presentation tool type may be registered at most once`,
        );
      }
      seen.add(type);

      // ai-review SUMMARY #6 — defaults 자체의 바이트 크기 상한. 1MB cap 은
      // 최종 merged payload 에만 적용되므로 defaults 자체가 거대해질 수 있다.
      // 비합리적 크기 (>256KB) 를 schema 단계에서 사전 차단.
      if (t.defaults !== undefined && t.defaults !== null) {
        try {
          const bytes = Buffer.byteLength(JSON.stringify(t.defaults));
          if (bytes > PRESENTATION_DEFAULTS_MAX_BYTES) {
            errors.push(
              `presentationTools[${i}]: defaults must be ≤ ${PRESENTATION_DEFAULTS_MAX_BYTES} bytes (got ${bytes})`,
            );
          }
        } catch {
          errors.push(
            `presentationTools[${i}]: defaults must be JSON-serialisable`,
          );
        }
      }
    }
  }

  return errors;
}

export const aiAgentNodeMetadata: NodeComponentMetadata = {
  type: 'ai_agent',
  category: 'ai',
  label: 'AI Agent',
  description: 'Chat with LLM using KB search and MCP server tools',
  icon: 'Brain',
  color: '#10B981',
  executionMetadata: { kind: 'standard' },
  isDynamicPorts: true,
  dynamicPorts: {
    kind: 'ai-agent-conditional',
    modeField: 'mode',
    conditionsField: 'conditions',
    multiTurnValue: 'multi_turn',
  },
  // SSOT for warnings (frontend canvas + backend handler.validate).
  // Mirror points:
  //  - frontend `aiAgentSummary` warning ("Default provider not
  //    configured") — see note on `validateAiAgentConfig` re: the
  //    `hasDefaultLlmConfig` context split.
  //  - backend handler.validate's "systemPrompt required for multi_turn"
  //    / "either systemPrompt or userPrompt required" / "max 20
  //    conditions" rules.
  // Per-condition structural validation (reserved port ids, prompt 2000
  // char cap, etc.) lives in `validateConfig` because the mini-DSL can't
  // model array iteration + sub-string comparisons.
  warningRules: [
    {
      id: 'ai_agent:no-llm-provider',
      when: '!model && !llmConfigId',
      message: AI_NO_LLM_PROVIDER_MESSAGE,
    },
    {
      id: 'ai_agent:multi-turn-needs-system-prompt',
      when: 'mode == multi_turn && !systemPrompt',
      message: 'Multi Turn mode requires System Prompt.',
    },
    {
      id: 'ai_agent:single-turn-needs-prompt',
      when: 'mode != multi_turn && !systemPrompt && !userPrompt',
      message: 'Either System Prompt or User Prompt must be entered.',
    },
    {
      id: 'ai_agent:too-many-conditions',
      when: 'length(conditions) > 20',
      message: 'Conditions are limited to 20 entries.',
    },
  ],
  validateConfig: validateAiAgentConfig,
};
