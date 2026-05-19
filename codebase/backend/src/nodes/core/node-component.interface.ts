import { ZodSchema } from 'zod';
import type { WarningRule } from '@workflow/node-summary';
import { NodeCategory } from '../../modules/nodes/entities/node.entity';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from './node-handler.interface';
import { NodeTypeMetadata } from './node-type-metadata';
import { LlmService } from '../../modules/llm/llm.service';
import { RagSearchService } from '../../modules/knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../../modules/knowledge-base/knowledge-base.service';
import { IntegrationsService } from '../../modules/integrations/integrations.service';
import { McpClientService } from '../../modules/mcp/mcp-client.service';
import type { ConversationThreadService } from '../../modules/execution-engine/conversation-thread/conversation-thread.service';
import { WorkflowExecutor } from './workflow-executor.interface';
import { WebsocketService } from '../../modules/websocket/websocket.service';

export type {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
};
export type { NodeTypeMetadata };
// Re-export so node component authors can import everything from one path.
export type { WarningRule, WarningSeverity } from '@workflow/node-summary';

export type NodePortKind = 'data' | 'error' | 'control';

export interface NodePort {
  id: string;
  label: string;
  type: NodePortKind;
}

export interface NodePorts {
  inputs: NodePort[];
  outputs: NodePort[];
}

/**
 * Structured form of `summaryTemplate` — pairs a template string with an
 * optional warning predicate so nodes can declare "template + when to flag as
 * misconfigured" in one place.
 */
export interface SummaryTemplateSpec {
  template: string;
  warnWhen?: string;
  warnMessage?: string;
}

/**
 * Declarative rule for generating a node's output ports from its `config` on
 * the canvas. The frontend resolver switches on `kind` to pick a generator
 * and uses the remaining fields as parameters.
 *
 * Keep the set closed (tagged union) — adding new dynamic-port behavior means
 * adding a new kind here AND a matching branch in `resolveDynamicPorts`.
 */
export type DynamicPortsSpec =
  | { kind: 'switch-cases' }
  | { kind: 'classifier-categories'; fallbackId: string; errorId: string }
  | {
      kind: 'ai-agent-conditional';
      modeField: string;
      conditionsField: string;
      multiTurnValue: string;
    }
  | {
      kind: 'info-extractor-mode';
      modeField: string;
      multiTurnValue: string;
    }
  | {
      kind: 'presentation-buttons';
      supportsItems?: boolean;
      supportsItemButtons?: boolean;
      continueId: string;
    }
  | { kind: 'parallel-branches' };

export interface NodeComponentMetadata {
  type: string;
  category: NodeCategory | `${NodeCategory}`;
  label: string;
  description: string;
  icon: string;
  color: string;
  /**
   * Engine dispatch metadata. **모든 NodeComponent 가 명시 필수** —
   * `kind: 'standard'` 도 생략 불가 (CRIT #3 시나리오 D).
   *
   * 본 필드를 통해 엔진은 hard-coded 문자열 분기 (`node.type === 'foreach'` 등)
   * 없이 `kind` flag 만으로 dispatch 한다. 새 노드 모듈은 NodeHandler 외에
   * 본 필드만 선언하면 자동 등록되며, registry 의 부팅 검증이 일관성을
   * 보장한다 (NodeHandlerRegistry.assertConsistency).
   *
   * 참조: `node-type-metadata.ts`, spec/5-system/4-execution-engine.md §3, §4.4.
   */
  executionMetadata: NodeTypeMetadata;
  isContainer?: boolean;
  /** True when output ports are generated dynamically at runtime (e.g. switch cases, carousel buttons). */
  isDynamicPorts?: boolean;
  /**
   * Declarative rule describing how the canvas should compute dynamic output
   * ports from `config`. When set, `isDynamicPorts` is implied. See
   * `DynamicPortsSpec` for supported kinds.
   */
  dynamicPorts?: DynamicPortsSpec;
  /**
   * Canvas summary template referenced by spec §1.4. Supports either a bare
   * template string or a structured spec with a warning predicate.
   *
   * Template syntax:
   *  - `{{path}}`                — interpolates `config.path`
   *  - `{{path.nested}}`         — dot-path into nested objects/arrays
   *  - `{{path.length}}`         — array length
   *  - `{{path|upper}}`          — filters: `upper`, `lower`
   *  - `{{path|default:GET}}`    — default value when path is missing/empty
   *
   * `warnWhen` syntax (any truthy match marks the summary as a warning):
   *  - `!path` / `!path.length`  — negation / empty-check
   *  - `path==value` / `path!=value` — equality comparisons
   *
   * For new code, prefer {@link warningRules} below — `summaryTemplate.warnWhen`
   * only supports a single warning per node, while `warningRules` accepts a
   * list with stable ids. Both keep working in parallel; `warningRules` fires
   * the canvas badge AND the assistant's `NODE_CONFIG_WARNINGS` review at the
   * same time, while `summaryTemplate.warnWhen` only affects display.
   */
  summaryTemplate?: string | SummaryTemplateSpec;
  /**
   * **SSOT for node config warnings** (Phase 6+).
   *
   * Each rule is evaluated by `@workflow/node-summary` `evaluateWarnings()`
   * against the node's `config`. Both the frontend canvas badge (⚠️) and the
   * backend `handler.validate()` / assistant `NODE_CONFIG_WARNINGS` review
   * consume the same list, so the two surfaces cannot drift.
   *
   * Default `severity` is `blocking` — the assistant refuses `finish` while
   * any blocking rule fires. Use `severity: 'advisory'` for soft hints that
   * should appear on the canvas but not block the assistant.
   *
   * Rules that need cross-field business logic the mini-DSL can't express
   * (regex, recursion) belong in {@link validateConfig} instead.
   */
  warningRules?: readonly WarningRule[];
  /**
   * Imperative escape hatch for warnings the {@link warningRules} mini-DSL
   * cannot express. Returns warning messages — same shape as
   * `handler.validate(config).errors`. Per the SSOT contract, this lives on
   * the same node component as the schema (no logic outside the node folder).
   *
   * Backend handlers automatically merge these into their `validate()` result
   * via `evaluateMetadataValidation` (handler-helpers.ts). Frontend skips this
   * field — it's backend-only because the imperative function may import
   * server-side modules.
   */
  validateConfig?: (config: unknown) => string[];
  /**
   * Optional explicit default config. When omitted, the registry derives the
   * default by running `configSchema.parse({})` — fields with `.default(...)`
   * in the zod schema populate automatically.
   */
  defaultConfig?: Record<string, unknown>;
}

/**
 * UI metadata attached to a zod field via `.meta({ ui: UiHint })`. Survives
 * `z.toJSONSchema()` and is consumed by the frontend auto-form renderer to
 * pick a widget and rendering options per field.
 *
 * Supported widget values:
 *  - text / textarea / number / select / checkbox  (basic primitives)
 *  - expression          — renders ExpressionInput (template syntax + autocomplete)
 *  - kv / kv-expression  — key-value list editor (expression-aware variant)
 *  - code                — monospaced multiline editor
 *  - integration-selector / llm-config-selector / kb-selector / workflow-selector / mcp-server-selector
 *  - condition-builder   — array-of-ConditionGroup editor (operators per spec §1.1)
 *  - field-array         — generic ordered array-of-object editor
 */
export interface UiHint {
  label?: string;
  placeholder?: string;
  hint?: string;
  widget?:
    | 'text'
    | 'textarea'
    | 'number'
    | 'select'
    | 'checkbox'
    | 'expression'
    | 'kv'
    | 'kv-expression'
    | 'code'
    | 'integration-selector'
    | 'llm-config-selector'
    | 'kb-selector'
    | 'workflow-selector'
    | 'mcp-server-selector'
    | 'condition-builder'
    | 'field-array'
    | 'button-list'
    | 'table-grid';
  /** Sort index within the form. Lower appears first. */
  order?: number;
  /** Hide from auto-form rendering (still validated). */
  hidden?: boolean;
  /**
   * Visibility DSL. Field is only shown when sibling matches the rule.
   *  - `{ field, equals }`    — shown when `config[field] === equals`
   *  - `{ field, notEquals }` — shown when `config[field] !== notEquals`
   *  - `{ field, oneOf }`     — shown when `oneOf.includes(config[field])`
   */
  visibleWhen?:
    | { field: string; equals: unknown }
    | { field: string; notEquals: unknown }
    | { field: string; oneOf: unknown[] };
  /**
   * Marks the field as always required for UI purposes. Use when zod `.default(...)`
   * makes a field optional in the JSON Schema's `required` array but the handler
   * still treats it as mandatory (e.g. each carousel item's title).
   */
  required?: boolean;
  /**
   * Required DSL for UI cues (asterisk) when zod's static `required` can't
   * express a mode-dependent constraint — e.g. Carousel's `titleField` is
   * only required in dynamic mode. Runtime enforcement still belongs to
   * `NodeHandler.validate()`.
   *
   * Single shape — `{ field, equals }` where `equals` is either:
   *  - a single value: required when `config[field] === equals`
   *  - a readonly array (whitelist): required when `equals.includes(config[field])`
   *
   * 2026-05-19 정준화 (consistency I-4 후속) — `notEquals` / `oneOf` 형태는
   * 제거됨. `notEquals` 는 향후 mode/enum 확장 시 의도와 다르게 신규 값에도
   * 자동 적용되는 블랙리스트 위험이 있어 화이트리스트 `equals: [...]` 로
   * 통일. `oneOf` 는 `equals: [...]` 와 의미 중복.
   */
  requiredWhen?: { field: string; equals: unknown | readonly unknown[] };
  /** Options for `widget: 'select'` when not derivable from z.enum. */
  options?: { value: string; label: string }[];
  /** For 'code' widget — language hint (javascript, sql, json, handlebars). */
  language?: string;
  /**
   * For 'expression' / 'textarea' widgets — render as a multi-line editor
   * instead of a single-line input. Pair with `rows` to control height.
   */
  multiline?: boolean;
  /** Row count for multi-line inputs (`multiline: true` or textarea widgets). */
  rows?: number;
  /** For array/object widgets — child item label. */
  itemLabel?: string;
  /** Default value for new items in array widgets. */
  itemDefault?: Record<string, unknown>;
  /** Group name for section grouping in the auto-form. */
  group?: string;
  /** When true, the section group renders as collapsible (with expand/collapse toggle). */
  collapsible?: boolean;
  /** Field keys to clear from config when this field's value changes (e.g. mode switch). */
  clearFields?: string[];
}

/**
 * Runtime dependencies passed to node component handler factories.
 * Only the services a handler actually needs should be consumed.
 */
export interface HandlerDependencies {
  llmService: LlmService;
  ragSearchService: RagSearchService;
  knowledgeBaseService: KnowledgeBaseService;
  integrationsService: IntegrationsService;
  mcpClientService: McpClientService;
  workflowExecutor: WorkflowExecutor;
  /** Optional — handlers that emit live debug WS events (e.g. AI Agent's
   *  tool_call_started/completed) consume it. Other handlers ignore. */
  websocketService?: WebsocketService;
  /** Optional — only the cafe24 node consumes it. Wired by
   *  ExecutionEngineService.registerHandlers (see spec/4-nodes/4-integration/4-cafe24.md). */
  cafe24ApiClient?: import('../integration/cafe24/cafe24-api.client').Cafe24ApiClient;
  /** AI handlers push user / assistant turns into the workflow-scoped
   *  ConversationThread (spec/conventions/conversation-thread.md §2.2).
   *  Other handlers ignore. Optional so legacy test fixtures that build
   *  handler instances without the engine wiring still work. */
  conversationThreadService?: ConversationThreadService;
}

/**
 * A self-contained node definition: metadata, port spec, config schema,
 * and a handler factory. One component per node type.
 */
export interface NodeComponent<TConfig = Record<string, unknown>> {
  metadata: NodeComponentMetadata;
  ports: NodePorts;
  configSchema: ZodSchema<TConfig>;
  inputSchema?: ZodSchema<unknown>;
  outputSchema?: ZodSchema<unknown>;
  createHandler: (deps: HandlerDependencies) => NodeHandler;
  /**
   * Optional extra payload shipped to the frontend through
   * `GET /nodes/definitions`. Use sparingly — most nodes are fully
   * described by `configSchema` + `metadata`. Designed for cases where
   * the dynamic form needs a lookup table the schema alone can't carry
   * (e.g. the cafe24 node ships its operations-by-resource catalog
   * derived from `codebase/backend/src/nodes/integration/cafe24/metadata/*`).
   *
   * Must return JSON-serializable data. Called once per
   * `GET /nodes/definitions` request from `NodeComponentRegistry`.
   */
  extras?: () => unknown;
}
