import { ToolDef } from '../../llm/interfaces/llm-client.interface';

/**
 * LLM에 전달될 function-calling 도구 목록.
 *
 * 세 가지 `kind`가 있다:
 * - **explore**: 읽기 전용. 캔버스에 영향을 주지 않음
 * - **plan**: `propose_plan` 단일 도구. 채팅 UI에만 영향
 * - **edit**: shadow 검증 후 프론트 editor-store에 반영
 * - (추가) `finish`: 루프 종료 신호
 */
export type AssistantToolKind = 'explore' | 'plan' | 'edit' | 'finish';

export const TOOL_KIND_BY_NAME: Record<string, AssistantToolKind> = {
  get_node_schema: 'explore',
  list_integrations: 'explore',
  list_workflows: 'explore',
  get_workflow: 'explore',
  list_knowledge_bases: 'explore',
  propose_plan: 'plan',
  add_node: 'edit',
  update_node: 'edit',
  remove_node: 'edit',
  add_edge: 'edit',
  remove_edge: 'edit',
  finish: 'finish',
};

export function buildAssistantTools(): ToolDef[] {
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
            description: 'Optional category filter (http, smtp, database, ...).',
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
        'Fetch a summary of another workflow (nodes, edges) to use as a reference.',
      parameters: {
        type: 'object',
        additionalProperties: false,
        properties: {
          id: { type: 'string', format: 'uuid' },
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
      name: 'list_knowledge_bases',
      description: 'List knowledge bases available for RAG-enabled AI Agent nodes.',
      parameters: { type: 'object', additionalProperties: false, properties: {} },
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
