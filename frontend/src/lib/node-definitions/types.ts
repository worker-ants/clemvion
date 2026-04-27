import type {
  SummaryTemplateSpec as SharedSummaryTemplateSpec,
  WarningRule,
} from "@workflow/node-summary";

export type PortDefinition = {
  id: string;
  label: string;
  type: "data" | "error" | "control";
};

export type NodeCategory =
  | "trigger"
  | "logic"
  | "flow"
  | "ai"
  | "integration"
  | "data"
  | "presentation";

export type NodeCategoryMeta = {
  id: NodeCategory;
  label: string;
  icon: string;
  color: string;
  order: number;
};

export type UiWidget =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "checkbox"
  | "expression"
  | "kv"
  | "kv-expression"
  | "code"
  | "integration-selector"
  | "llm-config-selector"
  | "kb-selector"
  | "workflow-selector"
  | "condition-builder"
  | "field-array"
  | "button-list"
  | "table-grid";

export type UiHint = {
  label?: string;
  placeholder?: string;
  hint?: string;
  widget?: UiWidget;
  order?: number;
  hidden?: boolean;
  visibleWhen?:
    | { field: string; equals: unknown }
    | { field: string; notEquals: unknown }
    | { field: string; oneOf: readonly unknown[] };
  /**
   * Marks the field as always required for UI purposes. Use when zod `.default(...)`
   * makes a field optional in the JSON Schema's `required` array but the handler
   * still treats it as mandatory (e.g. each carousel item's title).
   */
  required?: boolean;
  /**
   * Marks the field as required only when the rule matches the current config.
   * Same shape as `visibleWhen`. Used for UI cues (asterisk) when zod's static
   * `required` can't express a mode-dependent constraint — e.g. Carousel's
   * `titleField` is only required in dynamic mode.
   */
  requiredWhen?:
    | { field: string; equals: unknown }
    | { field: string; notEquals: unknown }
    | { field: string; oneOf: readonly unknown[] };
  options?: { value: string; label: string }[];
  language?: string;
  /**
   * For 'expression' / 'textarea' widgets — render as a multi-line editor
   * instead of a single-line input. Pair with `rows` to control height.
   */
  multiline?: boolean;
  /** Row count for multi-line inputs (`multiline: true` or textarea widgets). */
  rows?: number;
  itemLabel?: string;
  /** Default value for new items in array widgets. */
  itemDefault?: Record<string, unknown>;
  /** Group name for section grouping in the auto-form. */
  group?: string;
  /** When true, the section group renders as collapsible. */
  collapsible?: boolean;
  /** Field keys to clear from config when this field's value changes. */
  clearFields?: string[];
};

/** JSON Schema node with optional `ui` hint (from zod `.meta({ ui: ... })`). */
export type JsonSchemaNode = {
  type?: string | string[];
  enum?: unknown[];
  default?: unknown;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  required?: string[];
  items?: JsonSchemaNode;
  additionalProperties?: boolean | JsonSchemaNode;
  ui?: UiHint;
  // zod v4 emits various other keys (const, anyOf, oneOf, $ref, ...) we don't need yet
  [key: string]: unknown;
};

/**
 * Re-export of the SSOT `SummaryTemplateSpec` from `@workflow/node-summary`.
 * Kept as a local alias so existing imports
 * (`import type { SummaryTemplateSpec } from "@/lib/node-definitions/types"`)
 * continue to resolve unchanged.
 */
export type SummaryTemplateSpec = SharedSummaryTemplateSpec;

export type SummaryTemplate = string | SummaryTemplateSpec;

export type { WarningRule };

export type DynamicPortsSpec =
  | { kind: "switch-cases" }
  | { kind: "classifier-categories"; fallbackId: string; errorId: string }
  | {
      kind: "ai-agent-conditional";
      modeField: string;
      conditionsField: string;
      multiTurnValue: string;
    }
  | {
      kind: "info-extractor-mode";
      modeField: string;
      multiTurnValue: string;
    }
  | {
      kind: "presentation-buttons";
      supportsItems?: boolean;
      supportsItemButtons?: boolean;
      continueId: string;
    }
  | { kind: "parallel-branches" };

export type NodeMetadata = {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  isContainer?: boolean;
  isDynamicPorts?: boolean;
  dynamicPorts?: DynamicPortsSpec;
  summaryTemplate?: SummaryTemplate;
  /**
   * SSOT declarative warnings shipped from the backend node schema. The
   * canvas badge is derived purely from running `evaluateWarnings(config,
   * warningRules)` so the frontend warning matches the backend
   * `handler.validate()` result. The backend strips `validateConfig`
   * (function, imperative) before serializing, so this list is the only
   * warning surface visible to the frontend.
   */
  warningRules?: readonly WarningRule[];
};

/** Shape returned by `GET /nodes/definitions`. */
export type NodeDefinitionResponse = {
  metadata: NodeMetadata;
  ports: { inputs: PortDefinition[]; outputs: PortDefinition[] };
  configSchema: JsonSchemaNode;
  defaultConfig: Record<string, unknown>;
  inputSchema?: JsonSchemaNode;
  outputSchema?: JsonSchemaNode;
};

/** Flattened definition used by the rest of the app (palette, canvas, panels). */
export type NodeDefinition = {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  isContainer?: boolean;
  isDynamicPorts?: boolean;
  dynamicPorts?: DynamicPortsSpec;
  summaryTemplate?: SummaryTemplate;
  /** See {@link NodeMetadata.warningRules}. */
  warningRules?: readonly WarningRule[];
  defaultConfig: Record<string, unknown>;
  configSchema: JsonSchemaNode;
  inputSchema?: JsonSchemaNode;
  outputSchema?: JsonSchemaNode;
};
