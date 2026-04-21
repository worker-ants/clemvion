import { ToolDef } from '../../llm/interfaces/llm-client.interface';

/**
 * LLM에 전달될 function-calling 도구 목록.
 *
 * `kind` 분류:
 * - **explore**: 읽기 전용. 캔버스에 영향을 주지 않음
 * - **plan**: `propose_plan` / `clear_plan` — 채팅 UI·세션 컨텍스트에만
 *   영향, shadow workflow 변경 없음
 * - **edit**: shadow 검증 후 프론트 editor-store에 반영
 * - **finish**: 루프 종료 신호. 활성 plan 의 미완 여부 guard 대상
 */
export type AssistantToolKind = 'explore' | 'plan' | 'edit' | 'finish';

export const TOOL_KIND_BY_NAME: Record<string, AssistantToolKind> = {
  get_node_schema: 'explore',
  list_integrations: 'explore',
  list_workflows: 'explore',
  get_workflow: 'explore',
  get_current_workflow: 'explore',
  list_knowledge_bases: 'explore',
  propose_plan: 'plan',
  clear_plan: 'plan',
  add_node: 'edit',
  update_node: 'edit',
  remove_node: 'edit',
  add_edge: 'edit',
  remove_edge: 'edit',
  finish: 'finish',
};

function buildAssistantToolsInternal(): ToolDef[] {
  const position = {
    type: 'object',
    additionalProperties: false,
    properties: {
      x: { type: 'number' },
      y: { type: 'number' },
    },
    required: ['x', 'y'],
  } as const;

  return [
    // ─── Explore ─────────────────────────────────────────
    {
      name: 'get_node_schema',
      description:
        'Fetch the JSON Schema, ports, and description for a specific node type. Use this on-demand when the catalog summary is insufficient for configuring a node.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: {
            type: 'string',
            description: 'Node type identifier, e.g. "http_request".',
          },
        },
        required: ['type'],
      },
    },
    {
      name: 'list_integrations',
      description:
        'List integrations (HTTP auth, SMTP, DB, etc.) registered in the current workspace. Useful when deciding which integrationId to suggest in a node config.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          category: {
            type: 'string',
            description:
              'Optional category filter (http, smtp, database, ...).',
          },
        },
      },
    },
    {
      name: 'list_workflows',
      description:
        'List other workflows in the same workspace. Helpful for referencing or mirroring an existing design.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          search: {
            type: 'string',
            description: 'Optional name/description search substring.',
          },
          limit: { type: 'number', minimum: 1, maximum: 50 },
        },
      },
    },
    {
      name: 'get_workflow',
      description:
        'Fetch a summary of ANOTHER workflow (nodes, edges) to use as a reference. `id` MUST be a real UUID v4 obtained from a previous list_workflows() call — do not invent placeholder strings. For the CURRENT workflow being edited, the snapshot is already in the system prompt; if you need the latest state after making edits in this turn, call `get_current_workflow` instead.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: {
            type: 'string',
            format: 'uuid',
            description:
              'UUID of an existing workflow in this workspace. Obtain via list_workflows().',
          },
          mode: {
            type: 'string',
            enum: ['summary', 'full'],
            description: 'summary=labels+types only; full=includes config.',
          },
        },
        required: ['id'],
      },
    },
    {
      name: 'get_current_workflow',
      description:
        'Return the up-to-date list of nodes and edges on the user\'s canvas, including any edits already applied in THIS turn. The turn-start snapshot is also embedded in the system prompt — for plain read-only questions like "what\'s on the canvas?" or "find nodes of type X", read that snapshot directly (no tool call needed). Call this tool ONLY after you have invoked edit tools and need to verify the resulting state, or when you are unsure whether the snapshot is current. Sensitive config values (apiKey, secret, token, etc.) are redacted to "[REDACTED]" in the response.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
    },
    {
      name: 'list_knowledge_bases',
      description:
        'List knowledge bases available for RAG-enabled AI Agent nodes.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {},
      },
    },
    // ─── Plan ─────────────────────────────────────────
    {
      name: 'propose_plan',
      description:
        'Present a step-by-step plan to the user before making canvas edits. Use when the request is ambiguous, spans multiple nodes, or involves domain decisions. The user must approve before you can call edit tools.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          title: { type: 'string' },
          summary: { type: 'string' },
          steps: {
            type: 'array',
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                id: { type: 'string' },
                action: {
                  type: 'string',
                  enum: [
                    'add_node',
                    'update_node',
                    'remove_node',
                    'add_edge',
                    'remove_edge',
                    'note',
                  ],
                },
                description: { type: 'string' },
                rationale: { type: 'string' },
              },
              required: ['id', 'action', 'description'],
            },
          },
          openQuestions: {
            type: 'array',
            items: { type: 'string' },
          },
        },
        required: ['title', 'summary', 'steps'],
      },
    },
    {
      name: 'clear_plan',
      description:
        "Clear the active plan tracked across turns. Call this ONLY when the user's request has clearly moved on to unrelated work (topic change) or when you've determined the remaining steps are no longer valid. After this call, the Active plan context block will no longer appear in the system prompt and `finish` will not be blocked by leftover pending steps. If the user merely tweaks the current request, do NOT clear — resume the plan and optionally `propose_plan` again with adjustments.",
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          reason: {
            type: 'string',
            maxLength: 500,
            description:
              'Short sentence explaining why the plan is being cleared (topic change, user abandoned it, etc.). Stored on the assistant tool_calls row as audit trail. Max 500 chars.',
          },
        },
      },
    },
    // ─── Edit ─────────────────────────────────────────
    {
      name: 'add_node',
      description:
        'Add a new node to the workflow. Returns the assigned UUID on success. Respect the node-type catalog and CONVENTIONS §1.1 (config ↔ output orthogonality).',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          type: { type: 'string' },
          label: {
            type: 'string',
            description: 'Unique label within the workflow.',
          },
          position,
          config: {
            type: 'object',
            additionalProperties: true,
          },
          planStepId: { type: 'string' },
        },
        required: ['type', 'label', 'position', 'config'],
      },
    },
    {
      name: 'update_node',
      description:
        'Patch an existing node. Only provided fields are changed. Config is shallow-merged.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          patch: {
            type: 'object',
            additionalProperties: false,
            properties: {
              label: { type: 'string' },
              config: { type: 'object', additionalProperties: true },
              position,
            },
          },
          planStepId: { type: 'string' },
        },
        required: ['id', 'patch'],
      },
    },
    {
      name: 'remove_node',
      description: 'Delete a node and all connected edges.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          planStepId: { type: 'string' },
        },
        required: ['id'],
      },
    },
    {
      name: 'add_edge',
      description: 'Connect two nodes via a data or error edge.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          source_id: { type: 'string' },
          source_port: { type: 'string', default: 'out' },
          target_id: { type: 'string' },
          target_port: { type: 'string', default: 'in' },
          type: { type: 'string', enum: ['data', 'error'], default: 'data' },
          planStepId: { type: 'string' },
        },
        required: ['source_id', 'target_id'],
      },
    },
    {
      name: 'remove_edge',
      description: 'Delete an edge by id.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string' },
          planStepId: { type: 'string' },
        },
        required: ['id'],
      },
    },
    // ─── Finish ─────────────────────────────────────────
    {
      name: 'finish',
      description:
        'Signal the end of this turn when no further tool calls are needed.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          summary: { type: 'string' },
        },
      },
    },
  ];
}

/**
 * 런타임에 변하지 않는 도구 정의 목록. 매 턴 재생성 비용을 피하려 모듈
 * 상수로 한 번만 계산한다. 소비자는 `buildAssistantTools()` 를 호출해도
 * 같은 배열 참조를 받는다.
 */
const ASSISTANT_TOOLS: readonly ToolDef[] = Object.freeze(
  buildAssistantToolsInternal(),
);

export function buildAssistantTools(): ToolDef[] {
  return ASSISTANT_TOOLS as ToolDef[];
}
