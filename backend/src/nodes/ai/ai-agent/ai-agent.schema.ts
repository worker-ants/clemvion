import { z } from 'zod';
import {
  NodeComponentMetadata,
  NodePorts,
} from '../../core/node-component.interface';
import { AI_NO_LLM_PROVIDER_MESSAGE } from '../llm-provider-rule';

const toolOverrideSchema = z.object({
  nodeId: z.string().meta({
    ui: { label: 'Node ID', widget: 'text' },
  }),
  toolName: z
    .string()
    .optional()
    .meta({ ui: { label: 'Tool Name', widget: 'text' } }),
  toolDescription: z
    .string()
    .optional()
    .meta({ ui: { label: 'Tool Description', widget: 'textarea' } }),
  inputMapping: z
    .array(z.record(z.string(), z.unknown()))
    .optional()
    .meta({ ui: { label: 'Input Mapping', widget: 'field-array' } }),
});

const mcpServerRefSchema = z.object({
  integrationId: z
    .string()
    .meta({ ui: { label: 'Integration ID', widget: 'text', hidden: true } }),
  enabledTools: z
    .array(z.string())
    .optional()
    .meta({
      ui: {
        label: 'Enabled Tools',
        widget: 'field-array',
        hint: '비워두면 서버의 모든 일반 도구를 LLM 에 노출합니다.',
      },
    }),
  includeResources: z
    .boolean()
    .default(true)
    .meta({
      ui: {
        label: 'Expose Resources',
        widget: 'checkbox',
        hint: '서버가 resources capability 를 보고할 때 list/read 메타도구를 노출',
      },
    }),
  includePrompts: z
    .boolean()
    .default(true)
    .meta({
      ui: {
        label: 'Expose Prompts',
        widget: 'checkbox',
        hint: '서버가 prompts capability 를 보고할 때 list/get 메타도구를 노출',
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
          hint: '선택한 KB 가 LLM 에 검색 도구로 노출됩니다. LLM 이 사용자 의도를 보고 능동적으로 호출합니다.',
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
          hint: 'KB tool 호출 시 반환할 청크 수의 기본값 (LLM 이 호출 인자로 override 가능)',
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
          hint: '최소 유사도 임계값 (0-1) 의 기본값 (LLM 이 호출 인자로 override 가능)',
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
          hint: '워크스페이스에 등록된 MCP 서버를 추가하면 LLM 이 해당 서버의 도구를 능동적으로 호출합니다.',
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
    toolNodeIds: z
      .array(z.string())
      .default([])
      .meta({
        ui: {
          label: 'Tool Node IDs',
          widget: 'field-array',
          order: 33,
          group: 'Advanced',
        },
      }),
    toolOverrides: z
      .array(toolOverrideSchema)
      .default([])
      .meta({
        ui: {
          label: 'Tool Overrides',
          widget: 'field-array',
          itemLabel: 'Tool',
          order: 34,
          group: 'Advanced',
        },
      }),
    conversationHistory: z
      .enum(['none', 'last_n', 'full'])
      .default('none')
      .meta({
        ui: {
          label: 'Conversation History',
          widget: 'select',
          order: 35,
          group: 'Advanced',
          options: [
            { value: 'none', label: 'None' },
            { value: 'last_n', label: 'Last N Messages' },
            { value: 'full', label: 'Full History' },
          ],
        },
      }),
    historyCount: z
      .number()
      .int()
      .optional()
      .meta({
        ui: {
          label: 'History Count',
          widget: 'number',
          order: 36,
          group: 'Advanced',
          visibleWhen: { field: 'conversationHistory', equals: 'last_n' },
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
          order: 40,
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
 * `$node["X"].output.<field>` suggestions. The AI Agent handler returns a
 * legacy bare object (no `config/output` wrapper) so this schema describes a
 * FLAT output — contrast with `information-extractor` whose handler returns
 * `{ port, data: { config, output, meta } }` and surfaces a NESTED schema.
 *
 * The schema is a superset of every mode's return shape (single-turn, multi-
 * turn waiting, multi-turn final, condition route) and is intentionally
 * permissive (`.passthrough()` + `.optional()`) — we only need to enumerate
 * stable keys for autocomplete, not reject runtime data.
 */
export const aiAgentNodeOutputSchema = z
  .object({
    response: z.unknown().optional(),
    interactionType: z.string().optional(),
    status: z.string().optional(),
    messages: z.array(z.unknown()).optional(),
    turnCount: z.number().optional(),
    endReason: z.string().optional(),
    conversationConfig: z
      .object({
        message: z.string(),
        messages: z.array(z.unknown()),
        turnCount: z.number(),
        maxTurns: z.number(),
      })
      .partial()
      .passthrough()
      .optional(),
    condition: z
      .object({
        id: z.string(),
        label: z.string(),
        reason: z.string(),
      })
      .partial()
      .optional(),
    metadata: z
      .object({
        model: z.string(),
        inputTokens: z.number(),
        outputTokens: z.number(),
        totalTokens: z.number(),
        thinkingTokens: z.number(),
        toolCalls: z.number(),
        ragSources: z.array(z.unknown()),
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

  return errors;
}

export const aiAgentNodeMetadata: NodeComponentMetadata = {
  type: 'ai_agent',
  category: 'ai',
  label: 'AI Agent',
  description: 'Chat with LLM using RAG context',
  icon: 'Brain',
  color: '#10B981',
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
      message: 'Multi Turn 모드에서는 System Prompt 가 필요합니다.',
    },
    {
      id: 'ai_agent:single-turn-needs-prompt',
      when: 'mode != multi_turn && !systemPrompt && !userPrompt',
      message: 'System Prompt 또는 User Prompt 중 하나는 입력해야 합니다.',
    },
    {
      id: 'ai_agent:too-many-conditions',
      when: 'length(conditions) > 20',
      message: 'Conditions 는 최대 20개까지 추가할 수 있습니다.',
    },
  ],
  validateConfig: validateAiAgentConfig,
};
