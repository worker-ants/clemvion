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
  | "multiselect"
  | "checkbox"
  | "expression"
  | "kv"
  | "kv-expression"
  | "code"
  | "integration-selector"
  | "llm-config-selector"
  | "kb-selector"
  | "mcp-server-selector"
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
   * Used for UI cues (asterisk) when zod's static `required` can't express a
   * mode-dependent constraint — e.g. Carousel's `titleField` is only required
   * in dynamic mode.
   *
   * Single shape — `{ field, equals }` where `equals` is either:
   *  - a single value: required when `config[field] === equals`
   *  - a readonly array (whitelist): required when `equals.includes(config[field])`
   *
   * 2026-05-19 정준화 — `notEquals` / `oneOf` 형태는 제거됨 (blacklist
   * 위험 / 중복). 화이트리스트 의미가 필요하면 `equals: ['a', 'b']` 사용.
   */
  requiredWhen?: { field: string; equals: unknown | readonly unknown[] };
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
   * Re-run dry-run 지원 여부 (spec/5-system/13-replay-rerun.md §7). `true` 면
   * 이 노드 핸들러가 dry-run 시 외부 호출을 skip 하고 mock 출력을 반환한다.
   * Re-run modal 의 external-call 노드 카운트 + dry-run toggle 활성화 판정에
   * 사용된다. 백엔드 `NodeComponentMetadata.supportsDryRun` 를 미러링.
   */
  supportsDryRun?: boolean;
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
  /**
   * Optional per-node-type payload that doesn't fit the JSON Schema model.
   * Most nodes leave this undefined — currently only the `cafe24` node
   * ships a {@link Cafe24NodeExtras} catalog so its dynamic Operation
   * select + typed Fields form can render without an extra round trip.
   * Consumers should narrow by `node.type` before reading.
   */
  extras?: Record<string, unknown>;
};

/**
 * Shape of the `cafe24` node's `extras` payload. Mirrors the backend's
 * `PublicCafe24Extras` (`codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts`).
 * `method` / `path` are intentionally absent — the frontend renders the
 * form from labels + field types only.
 */
export type Cafe24NodeExtras = {
  operationsByResource: Record<string, Cafe24SupportedOperation[]>;
  plannedByResource: Record<string, Cafe24PlannedOperation[]>;
};

/**
 * Mirrors the backend `Cafe24FieldType` in
 * `codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`. Keep this union
 * in sync with the backend definition and with `spec/conventions/cafe24-api-metadata.md` §2.
 * Frontend doesn't import backend modules, so additions here are silent
 * unless mirrored on both sides.
 */
export type Cafe24FieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "enum";

/** Mirrors backend `Cafe24FieldLocation`. See note on {@link Cafe24FieldType}. */
export type Cafe24FieldLocation = "path" | "query" | "body";

export type Cafe24OperationField = {
  name: string;
  type: Cafe24FieldType;
  location: Cafe24FieldLocation;
  required: boolean;
  description?: string;
  enum?: readonly string[];
  default?: unknown;
};

export type Cafe24ApprovalGroup =
  | "mileage"
  | "notification"
  | "privacy"
  | "activitylogs"
  | "menus"
  | "naverpay_setting"
  | "kakaopay_setting"
  | "pg_settings"
  | "analytics";

export type Cafe24RestrictedApproval = {
  level: "scope" | "operation" | "program";
  approvalGroup: Cafe24ApprovalGroup;
  docsUrl?: string;
  inquiryUrl: string;
};

export type Cafe24SupportedOperation = {
  status: "supported";
  id: string;
  /**
   * i18n dict (`cafe24Catalog.<key>`) lookup key. 형식: `cafe24.<resource>.<id>`.
   * SoT: `spec/conventions/cafe24-api-metadata.md §7.5`. dict lookup miss 시
   * 본 키 자체를 그대로 노출 (fallback) — drift 즉시 감지.
   */
  labelKey: string;
  description: string;
  scope: "read" | "write";
  paginated: boolean;
  requiredFields: readonly string[];
  fields: readonly Cafe24OperationField[];
  /**
   * Cafe24 partner-approval marker — present iff backend metadata declared it.
   * SoT: `spec/conventions/cafe24-restricted-scopes.md`.
   */
  restrictedApproval?: Cafe24RestrictedApproval;
};

export type Cafe24PlannedOperation = {
  status: "planned";
  id: string;
  /** `cafe24.<resource>.<id>` — same shape as supported. */
  labelKey: string;
  paginated: boolean;
};

export type Cafe24Operation = Cafe24SupportedOperation | Cafe24PlannedOperation;

// ---------------------------------------------------------------------------
// MakeShop node extras
//
// Mirrors the backend `PublicMakeshopExtras`
// (`codebase/backend/src/nodes/integration/makeshop/metadata/public-meta.ts`).
// Divergences from the Cafe24 shape:
//   - No `plannedByResource` channel — every MakeShop operation is `supported`.
//   - No `restrictedApproval` / partner-approval tier (MakeShop has none).
// `method` / `path` are intentionally absent — the frontend renders the
// dynamic form from labels + field types only.
// ---------------------------------------------------------------------------

/** Mirrors backend `MakeshopFieldType`. Keep in sync with the backend metadata
 * model + `spec/conventions/makeshop-api-metadata.md` §2. */
export type MakeshopFieldType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object"
  | "enum";

/** Mirrors backend `MakeshopFieldLocation`. */
export type MakeshopFieldLocation = "path" | "query" | "body";

export type MakeshopOperationField = {
  name: string;
  type: MakeshopFieldType;
  location: MakeshopFieldLocation;
  required: boolean;
  description?: string;
  enum?: readonly string[];
  default?: unknown;
};

export type MakeshopSupportedOperation = {
  status: "supported";
  id: string;
  /**
   * i18n dict (`makeshopCatalog.<key>`) lookup key. 형식:
   * `makeshop.<resource>.<id>`. SoT: `spec/conventions/makeshop-api-metadata.md` §2.
   * dict lookup miss 시 본 키 자체를 그대로 노출 (fallback) — drift 즉시 감지.
   */
  labelKey: string;
  description: string;
  scope: "read" | "write";
  paginated: boolean;
  requiredFields: readonly string[];
  fields: readonly MakeshopOperationField[];
};

/**
 * Shape of the `makeshop` node's `extras` payload. Unlike Cafe24 there is no
 * `plannedByResource` channel — every operation is supported.
 */
export type MakeshopNodeExtras = {
  operationsByResource: Record<string, MakeshopSupportedOperation[]>;
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
  /** See {@link NodeMetadata.supportsDryRun}. */
  supportsDryRun?: boolean;
  /** See {@link NodeMetadata.warningRules}. */
  warningRules?: readonly WarningRule[];
  defaultConfig: Record<string, unknown>;
  configSchema: JsonSchemaNode;
  inputSchema?: JsonSchemaNode;
  outputSchema?: JsonSchemaNode;
  /** See {@link NodeDefinitionResponse.extras}. */
  extras?: Record<string, unknown>;
};
