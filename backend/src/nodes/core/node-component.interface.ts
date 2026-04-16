import { ZodSchema } from 'zod';
import { NodeCategory } from '../../modules/nodes/entities/node.entity';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
} from '../../modules/execution-engine/handlers/node-handler.interface';
import { LlmService } from '../../modules/llm/llm.service';
import { RagSearchService } from '../../modules/knowledge-base/search/rag-search.service';
import { IntegrationsService } from '../../modules/integrations/integrations.service';
import { WorkflowExecutor } from '../../modules/execution-engine/handlers/flow/workflow-executor.interface';

export type {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
};

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

export interface NodeComponentMetadata {
  type: string;
  category: NodeCategory | `${NodeCategory}`;
  label: string;
  description: string;
  icon: string;
  color: string;
  isContainer?: boolean;
  /** True when output ports are generated dynamically at runtime (e.g. switch cases, carousel buttons). */
  isDynamicPorts?: boolean;
  /** Canvas summary template referenced by spec §1.4. */
  summaryTemplate?: string;
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
 *  - integration-selector / llm-config-selector / kb-selector / workflow-selector
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
  /** Options for `widget: 'select'` when not derivable from z.enum. */
  options?: { value: string; label: string }[];
  /** For 'code' widget — language hint (javascript, sql, json, handlebars). */
  language?: string;
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
  integrationsService: IntegrationsService;
  workflowExecutor: WorkflowExecutor;
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
}
