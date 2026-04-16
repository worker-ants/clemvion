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
    | { field: string; oneOf: unknown[] };
  options?: { value: string; label: string }[];
  language?: string;
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

export type NodeMetadata = {
  type: string;
  category: NodeCategory;
  label: string;
  description: string;
  icon: string;
  color: string;
  isContainer?: boolean;
  isDynamicPorts?: boolean;
  summaryTemplate?: string;
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
  defaultConfig: Record<string, unknown>;
  configSchema: JsonSchemaNode;
  inputSchema?: JsonSchemaNode;
  outputSchema?: JsonSchemaNode;
};
