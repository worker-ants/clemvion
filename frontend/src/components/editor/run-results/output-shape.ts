/**
 * The execution engine emits node handler results in one of two shapes:
 *
 *   **New** (post-migration): `{ config, output, meta?, port?, status? }`
 *   **Legacy**: a flat object (e.g. `{ rows, rowCount, ... }` or a bare array)
 *
 * This helper normalises both into a single view so the UI can always render
 * the "actual produced value" separately from config echo / observability
 * metadata.
 */

export interface UnwrappedNodeOutput {
  /** The primary produced value that downstream nodes / users care about. */
  output: unknown;
  /** Echoed resolved config (may be null for legacy handlers). */
  config: Record<string, unknown> | null;
  /** Observability metadata (durationMs, statusCode, tokensUsed, etc.). */
  meta: Record<string, unknown> | null;
  /** Port selector (`success`/`error`/case ids). */
  port: string | null;
  /** Engine directive (`waiting_for_input`, `requires_integration`, etc.). */
  status: string | null;
  /** True when the raw value already followed the new `{ config, output }` shape. */
  isStructured: boolean;
}

export function unwrapNodeOutput(raw: unknown): UnwrappedNodeOutput {
  if (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "config" in raw &&
    "output" in raw
  ) {
    const obj = raw as Record<string, unknown>;
    return {
      output: obj.output,
      config: toRecord(obj.config),
      meta: toRecord(obj.meta),
      port: typeof obj.port === "string" ? obj.port : null,
      status: typeof obj.status === "string" ? obj.status : null,
      isStructured: true,
    };
  }

  // Partial new shape: config echoed without a final output (waiting state).
  // Conversation handlers surface node config here so the Config tab keeps
  // working while the node is still awaiting user input.
  if (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "config" in raw
  ) {
    const obj = raw as Record<string, unknown>;
    return {
      output: null,
      config: toRecord(obj.config),
      meta: toRecord(obj.meta),
      port: typeof obj.port === "string" ? obj.port : null,
      status: typeof obj.status === "string" ? obj.status : null,
      isStructured: true,
    };
  }

  // Legacy: the raw value IS the output. Extract status/port if present.
  const status =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).status
      : undefined;
  const port =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).port
      : undefined;

  return {
    output: raw,
    config: null,
    meta: null,
    port: typeof port === "string" ? port : null,
    status: typeof status === "string" ? status : null,
    isStructured: false,
  };
}

/**
 * Detect whether outputData represents a multi-turn conversation result.
 * Handles all three shapes we emit:
 *   - Legacy flat completed (top-level `messages` + `interactionType`)
 *   - New wrapped completed (`{ config, output: { messages }, meta: { interactionType } }`)
 *   - Waiting (top-level `interactionType: 'ai_conversation'` + `conversationConfig`,
 *     with or without the new `config` echo — in which case `unwrapNodeOutput`
 *     returns `output: null`, so the top-level probe below is required)
 */
export function isConversationOutput(outputData: unknown): boolean {
  if (!outputData || typeof outputData !== "object" || Array.isArray(outputData))
    return false;
  const raw = outputData as Record<string, unknown>;

  // Waiting shape: the top-level object itself carries `interactionType`
  // and/or `conversationConfig`. This also covers legacy flat-completed
  // payloads that put `messages`/`interactionType` at the top level.
  if (
    raw.interactionType === "ai_conversation" ||
    raw.conversationConfig != null
  ) {
    return true;
  }

  // New wrapped completed: conversation markers live inside output / meta.
  const unwrapped = unwrapNodeOutput(outputData);
  const output = unwrapped.output as Record<string, unknown> | null;
  if (!output || typeof output !== "object") return false;

  const hasMessages = Array.isArray(output.messages);
  const outputInteraction = output.interactionType === "ai_conversation";
  const metaInteraction = unwrapped.meta?.interactionType === "ai_conversation";
  const hasConvConfig = !!output.conversationConfig;

  return (hasMessages && (outputInteraction || metaInteraction)) || hasConvConfig;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Extract Information Extractor's collected fields from any output shape:
 *
 *  - Completed final: `{ config, output: { extracted }, meta }` via the
 *    `{ port, data }` engine envelope, unwrapped before storage.
 *  - Waiting (multi-turn not yet finalised): `{ interactionType,
 *    conversationConfig: { extracted, missingFields, collectionRetryCount,
 *    maxCollectionRetries, ... } }` returned by `buildWaitingResponse`.
 *  - Single-turn: `{ config, output: { extracted } }`.
 *
 * Returns null when the payload isn't an Information Extractor shape.
 */
export interface ExtractedSnapshot {
  fields: Record<string, unknown>;
  schema?: Array<{
    name: string;
    type?: string;
    description?: string;
    required?: boolean;
  }>;
  retry?: { count: number; max: number };
  /** True when the collection is still in-progress (waiting shape). */
  inProgress: boolean;
}

export function extractIeSnapshot(raw: unknown): ExtractedSnapshot | null {
  if (!raw || typeof raw !== "object") return null;
  const asRecord = raw as Record<string, unknown>;

  // Waiting shape (live): conversationConfig carries partial extraction.
  const convConfig = toRecord(asRecord.conversationConfig);
  if (convConfig && toRecord(convConfig.extracted)) {
    const retryCount = convConfig.collectionRetryCount;
    const retryMax = convConfig.maxCollectionRetries;
    return {
      fields: (convConfig.extracted as Record<string, unknown>) ?? {},
      retry:
        typeof retryCount === "number" && typeof retryMax === "number"
          ? { count: retryCount, max: retryMax }
          : undefined,
      inProgress: true,
    };
  }

  // Finalised shape: unwrap and look at output.extracted + config.schema
  const unwrapped = unwrapNodeOutput(raw);
  const output = toRecord(unwrapped.output);
  const extracted = output ? toRecord(output.extracted) : null;
  if (!extracted) return null;

  const config = unwrapped.config;
  const schemaRaw = config ? toRecord(config) : null;
  const schema = schemaRaw?.schema;
  return {
    fields: extracted,
    schema: Array.isArray(schema)
      ? (schema as Array<{
          name: string;
          type?: string;
          description?: string;
          required?: boolean;
        }>)
      : undefined,
    inProgress: false,
  };
}

/**
 * Canonical AI metadata surfaced in the Output tab for AI Agent / Text
 * Classifier / Information Extractor. Values are `null` when the underlying
 * shape doesn't report that field (e.g. Anthropic has no standalone
 * thinkingTokens, Text Classifier has no turnCount / toolCalls).
 */
export interface AiMetadata {
  model: string | null;
  totalTokens: number | null;
  requestTokens: number | null;
  responseTokens: number | null;
  thinkingTokens: number | null;
  turnCount: number | null;
  toolCalls: number | null;
}

function pickNumber(
  source: Record<string, unknown> | null,
  ...keys: string[]
): number | null {
  if (!source) return null;
  for (const k of keys) {
    const v = source[k];
    if (typeof v === "number" && Number.isFinite(v)) return v;
  }
  return null;
}

function pickString(
  source: Record<string, unknown> | null,
  key: string,
): string | null {
  if (!source) return null;
  const v = source[key];
  return typeof v === "string" ? v : null;
}

/**
 * Extract the canonical AI metadata from a node's raw output data. Handles:
 * - AI Agent (legacy flat shape: metadata nested under `output.metadata`)
 * - Text Classifier (new shape: fields in wrapper `meta`)
 * - Information Extractor single-turn / multi-turn (new shape, same as above)
 * Returns `null` when the node doesn't look like an AI node (no `model` on
 * either the meta wrapper or output.metadata), so callers can skip rendering
 * cleanly.
 */
export function extractAiMetadata(raw: unknown): AiMetadata | null {
  const unwrapped = unwrapNodeOutput(raw);
  const output = toRecord(unwrapped.output);
  const wrapperMeta = unwrapped.meta;
  const legacyMeta = output ? toRecord(output.metadata) : null;

  // Decide which metadata bag holds the AI fields. wrapperMeta wins when both
  // are present (new shape is canonical).
  const meta = wrapperMeta ?? legacyMeta;
  if (!meta) return null;

  // Guard against non-AI nodes that happen to carry a `meta` object — require
  // a recognisable token field before we treat this as AI metadata.
  const hasAnyTokenField =
    "model" in meta ||
    "totalTokens" in meta ||
    "inputTokens" in meta ||
    "outputTokens" in meta ||
    "totalInputTokens" in meta ||
    "totalOutputTokens" in meta ||
    "thinkingTokens" in meta;
  if (!hasAnyTokenField) return null;

  const turnCountFromOutput = pickNumber(output, "turnCount");

  return {
    model: pickString(meta, "model"),
    totalTokens: pickNumber(meta, "totalTokens"),
    requestTokens: pickNumber(meta, "totalInputTokens", "inputTokens"),
    responseTokens: pickNumber(meta, "totalOutputTokens", "outputTokens"),
    thinkingTokens: pickNumber(meta, "thinkingTokens", "totalThinkingTokens"),
    turnCount: pickNumber(meta, "turnCount") ?? turnCountFromOutput,
    toolCalls: pickNumber(meta, "toolCalls"),
  };
}

/** Meta keys the Output tab's AI metadata grid already shows. Callers use
 * this to filter the generic `meta` pill list so values don't render twice. */
export const AI_META_KEYS_IN_GRID = new Set([
  "model",
  "totalTokens",
  "inputTokens",
  "outputTokens",
  "totalInputTokens",
  "totalOutputTokens",
  "thinkingTokens",
  "totalThinkingTokens",
  "turnCount",
  "toolCalls",
  "interactionType",
  "ragSources",
]);
