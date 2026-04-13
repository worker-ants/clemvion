type NodeConfig = Record<string, unknown>;

export type ConfigSummaryResult = {
  text: string;
  isWarning: boolean;
};

export type SummaryContext = {
  hasDefaultLlmConfig?: boolean;
};

const OPERATOR_DISPLAY: Record<string, string> = {
  eq: "==",
  neq: "!=",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  contains: "contains",
  not_contains: "not contains",
  starts_with: "starts with",
  ends_with: "ends with",
  is_empty: "is empty",
  is_not_empty: "is not empty",
  regex: "~=",
  is_null: "is null",
};

const UNARY_OPERATORS = new Set(["is_empty", "is_not_empty", "is_null"]);

const LANG_DISPLAY: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  sql: "SQL",
};

/** Returns a warning ConfigSummaryResult with a human-readable detail string. */
function warning(detail: string): ConfigSummaryResult {
  return { text: `⚠ ${detail}`, isWarning: true };
}

// --- Per-node formatters ---

function ifElseSummary(config: NodeConfig): ConfigSummaryResult {
  const conditions = config.conditions as Array<{ field: string; operator: string; value: string }> | undefined;
  if (!Array.isArray(conditions) || !conditions.length || !conditions[0].field) return warning("Condition not set");
  const c = conditions[0];
  const op = OPERATOR_DISPLAY[c.operator] ?? c.operator;
  const text = UNARY_OPERATORS.has(c.operator) ? `${c.field} ${op}` : `${c.field} ${op} ${c.value}`;
  return { text, isWarning: false };
}

function switchSummary(config: NodeConfig): ConfigSummaryResult {
  const switchValue = config.switchValue as string | undefined;
  if (!switchValue) return warning("Switch value not set");
  const cases = Array.isArray(config.cases) ? config.cases : [];
  return { text: `${switchValue} \u2192 ${cases.length} cases`, isWarning: false };
}

function loopSummary(config: NodeConfig): ConfigSummaryResult {
  const count = config.count as string | undefined;
  if (!count) return warning("Count not set");
  const breakCond = config.breakCondition as string | undefined;
  const text = breakCond ? `${count}x \u00b7 break condition` : `${count}x`;
  return { text, isWarning: false };
}

function formatVariable(v: { name: string; type?: string; defaultValue?: string }): string {
  const parts = [v.name];
  if (v.type) parts.push(`: ${v.type}`);
  if (v.defaultValue !== undefined && v.defaultValue !== "") parts.push(` = ${v.defaultValue}`);
  return parts.join("");
}

function variableDeclarationSummary(config: NodeConfig): ConfigSummaryResult {
  const variables = config.variables as Array<{ name: string; type?: string; defaultValue?: string }> | undefined;
  if (!Array.isArray(variables) || !variables.length) return warning("No variables defined");
  const valid = variables.filter((v) => v.name);
  if (!valid.length) return warning("No variables defined");
  if (valid.length <= 2) return { text: valid.map(formatVariable).join(", "), isWarning: false };
  return { text: `${valid.slice(0, 2).map(formatVariable).join(", ")}, +${valid.length - 2}`, isWarning: false };
}

function variableModificationSummary(config: NodeConfig): ConfigSummaryResult {
  const modifications = config.modifications as Array<{ variable: string; operation: string }> | undefined;
  if (!Array.isArray(modifications) || !modifications.length || !modifications[0].variable) return warning("Variable not selected");
  const m = modifications[0];
  return { text: `${m.variable} ${m.operation}`, isWarning: false };
}

function splitSummary(config: NodeConfig): ConfigSummaryResult {
  const fieldPath = config.fieldPath as string | undefined;
  if (!fieldPath) return warning("Field path not set");
  return { text: fieldPath, isWarning: false };
}

function mapSummary(config: NodeConfig): ConfigSummaryResult {
  const inputField = config.inputField as string | undefined;
  if (!inputField) return warning("Input field not set");
  return { text: inputField, isWarning: false };
}

function foreachSummary(config: NodeConfig): ConfigSummaryResult {
  const arrayField = config.arrayField as string | undefined;
  if (!arrayField) return warning("Array field not set");
  const errorPolicy = config.errorPolicy as string | undefined;
  if (errorPolicy && errorPolicy !== "stop") {
    return { text: `${arrayField} \u00b7 ${errorPolicy} errors`, isWarning: false };
  }
  return { text: arrayField, isWarning: false };
}

function filterSummary(config: NodeConfig): ConfigSummaryResult {
  const inputField = config.inputField as string | undefined;
  if (!inputField) return warning("Input field not set");
  const conditions = Array.isArray(config.conditions) ? config.conditions : [];
  const combineMode = ((config.combineMode as string) ?? "and").toUpperCase();
  const condCount = conditions.length;
  const condLabel = condCount === 1 ? "condition" : "conditions";
  return { text: `${inputField} \u00b7 ${condCount} ${condLabel} \u00b7 ${combineMode}`, isWarning: false };
}

function mergeSummary(config: NodeConfig): ConfigSummaryResult {
  const inputCount = typeof config.inputCount === "number" ? config.inputCount : undefined;
  const strategy = config.strategy as string | undefined;
  if (inputCount == null && !strategy) return warning("Input count and strategy not set");
  if (inputCount == null) return warning("Input count not set");
  if (!strategy) return warning("Strategy not set");
  return { text: `${inputCount} inputs \u00b7 ${strategy}`, isWarning: false };
}

function workflowSummary(config: NodeConfig): ConfigSummaryResult {
  const workflowId = config.workflowId as string | undefined;
  if (!workflowId) return warning("Workflow not selected");
  const mode = (config.mode as string) ?? "sync";
  const workflowName = config.workflowName as string | undefined;
  const label = workflowName || workflowId;
  return { text: `${label} \u00b7 ${mode}`, isWarning: false };
}

function httpRequestSummary(config: NodeConfig): ConfigSummaryResult {
  const url = config.url as string | undefined;
  if (!url) return warning("URL not set");
  const method = (config.method as string) ?? "GET";
  return { text: `${method} ${url}`, isWarning: false };
}

function databaseQuerySummary(config: NodeConfig): ConfigSummaryResult {
  const query = config.query as string | undefined;
  if (!query) return warning("Query not set");
  const queryType = ((config.queryType as string) ?? "select").toUpperCase();
  const nlIndex = query.indexOf("\n");
  const firstLine = nlIndex === -1 ? query : query.slice(0, nlIndex);
  return { text: `${queryType} \u00b7 ${firstLine}`, isWarning: false };
}

function slackSummary(config: NodeConfig): ConfigSummaryResult {
  const action = config.action as string | undefined;
  if (!action) return warning("Action not selected");
  const channel = config.channel as string | undefined;
  if (channel) return { text: `${action} \u00b7 ${channel}`, isWarning: false };
  return { text: action, isWarning: false };
}

function sendEmailSummary(config: NodeConfig): ConfigSummaryResult {
  const to = config.to as string | undefined;
  if (!to) return warning("Recipient not set");
  const recipients = to.split(",").map((s) => s.trim()).filter(Boolean);
  if (recipients.length <= 1) return { text: `to: ${to}`, isWarning: false };
  return { text: `to: ${recipients[0]}, +${recipients.length - 1}`, isWarning: false };
}

function transformSummary(config: NodeConfig): ConfigSummaryResult {
  const operations = config.operations as unknown[] | undefined;
  if (!Array.isArray(operations) || !operations.length) return warning("No operations defined");
  return { text: `${operations.length} operations`, isWarning: false };
}

function codeSummary(config: NodeConfig): ConfigSummaryResult {
  const code = config.code as string | undefined;
  if (!code) return warning("Code not written");
  const language = (config.language as string) ?? "javascript";
  const displayLang = LANG_DISPLAY[language] ?? language.charAt(0).toUpperCase() + language.slice(1);
  const lineCount = (code.match(/\n/g)?.length ?? 0) + 1;
  return { text: `${displayLang} \u00b7 ${lineCount} ${lineCount === 1 ? "line" : "lines"}`, isWarning: false };
}

function buttonSuffix(config: NodeConfig): string | null {
  const buttons = Array.isArray(config.buttons) ? config.buttons : [];
  return buttons.length > 0 ? `${buttons.length} buttons` : null;
}

function carouselSummary(config: NodeConfig): ConfigSummaryResult {
  const mode = (config.mode as string) ?? "dynamic";
  const layout = (config.layout as string) || "card";
  const btnSuffix = buttonSuffix(config);
  if (btnSuffix) {
    return { text: `${layout} \u00b7 ${btnSuffix}`, isWarning: false };
  }
  if (mode === "static") {
    const items = Array.isArray(config.items) ? config.items : [];
    return { text: `${layout} \u00b7 ${items.length} items`, isWarning: false };
  }
  const titleField = config.titleField as string | undefined;
  if (titleField) return { text: `${layout} \u00b7 ${titleField}`, isWarning: false };
  return { text: layout, isWarning: false };
}

function tableSummary(config: NodeConfig): ConfigSummaryResult {
  const columns = config.columns as unknown[] | undefined;
  if (!Array.isArray(columns) || !columns.length) return warning("Columns not defined");
  const count = columns.length;
  const colLabel = count === 1 ? "column" : "columns";
  const btnSuffix = buttonSuffix(config);
  if (btnSuffix) {
    return { text: `${count} ${colLabel} \u00b7 ${btnSuffix}`, isWarning: false };
  }
  const mode = (config.mode as string) ?? "dynamic";
  const modeLabel = mode === "static" ? "static" : "dynamic";
  const parts = [`${modeLabel} · ${count} ${colLabel}`];
  if (config.pagination !== false) parts.push("pagination");
  return { text: parts.join(" · "), isWarning: false };
}

function chartSummary(config: NodeConfig): ConfigSummaryResult {
  const chartType = config.chartType as string | undefined;
  if (!chartType) return warning("Chart type not selected");
  const btnSuffix = buttonSuffix(config);
  if (btnSuffix) {
    return { text: `${chartType} \u00b7 ${btnSuffix}`, isWarning: false };
  }
  const xAxisField = config.xAxisField as string | undefined;
  const yAxisField = config.yAxisField as string | undefined;
  if (!xAxisField || !yAxisField) return warning("Axis fields not set");
  return { text: `${chartType} \u00b7 ${xAxisField} / ${yAxisField}`, isWarning: false };
}

function formSummary(config: NodeConfig): ConfigSummaryResult {
  const fields = config.fields as unknown[] | undefined;
  if (!Array.isArray(fields) || !fields.length) return warning("No fields defined");
  const count = fields.length;
  const label = count === 1 ? "field" : "fields";
  const title = config.title as string | undefined;
  if (title) return { text: `${count} ${label} \u00b7 "${title}"`, isWarning: false };
  return { text: `${count} ${label}`, isWarning: false };
}

function templateSummary(config: NodeConfig): ConfigSummaryResult {
  const template = config.template as string | undefined;
  if (!template) return warning("Template not set");
  const outputFormat = (config.outputFormat as string) ?? "html";
  const btnSuffix = buttonSuffix(config);
  if (btnSuffix) {
    return { text: `${outputFormat} \u00b7 ${btnSuffix}`, isWarning: false };
  }
  const lineCount = (template.match(/\n/g)?.length ?? 0) + 1;
  return { text: `${outputFormat} \u00b7 ${lineCount} ${lineCount === 1 ? "line" : "lines"}`, isWarning: false };
}

function pdfSummary(config: NodeConfig): ConfigSummaryResult {
  const template = config.template as string | undefined;
  if (!template) return warning("Template not set");
  const pageSize = (config.pageSize as string) ?? "A4";
  const orientation = (config.orientation as string) ?? "portrait";
  const fileName = (config.fileName as string) ?? "document.pdf";
  return { text: `${pageSize} ${orientation} \u00b7 ${fileName}`, isWarning: false };
}

function aiAgentSummary(config: NodeConfig, context?: SummaryContext): ConfigSummaryResult {
  const model = config.model as string | undefined;
  const llmConfigId = config.llmConfigId as string | undefined;
  if (!model && !llmConfigId && !context?.hasDefaultLlmConfig) return warning("Default provider not configured");
  const mode = config.mode as string | undefined;
  const parts: string[] = [];
  if (mode === "multi_turn") parts.push("Multi Turn");
  if (model) parts.push(model);
  const tools = Array.isArray(config.toolNodeIds) ? config.toolNodeIds : undefined;
  if (tools?.length) parts.push(`${tools.length} tools`);
  const kbs = Array.isArray(config.knowledgeBases) ? config.knowledgeBases : undefined;
  if (kbs?.length) parts.push(`${kbs.length} KB`);
  const conds = Array.isArray(config.conditions) ? config.conditions : undefined;
  if (conds?.length) parts.push(`${conds.length} cond`);
  return { text: parts.join(" \u00b7 ") || "Configured", isWarning: false };
}

function textClassifierSummary(config: NodeConfig, context?: SummaryContext): ConfigSummaryResult {
  const model = config.model as string | undefined;
  const llmConfigId = config.llmConfigId as string | undefined;
  const categories = config.categories as unknown[] | undefined;
  if (!model && !llmConfigId && !context?.hasDefaultLlmConfig) return warning("Default provider not configured");
  if (!Array.isArray(categories) || !categories.length) return warning("Categories not defined");
  const parts: string[] = [];
  if (model) parts.push(model);
  parts.push(`${categories.length} categories`);
  return { text: parts.join(" \u00b7 ") || "Configured", isWarning: false };
}

function informationExtractorSummary(config: NodeConfig, context?: SummaryContext): ConfigSummaryResult {
  const model = config.model as string | undefined;
  const llmConfigId = config.llmConfigId as string | undefined;
  const outputSchema = config.outputSchema as unknown[] | undefined;
  if (!model && !llmConfigId && !context?.hasDefaultLlmConfig) return warning("Default provider not configured");
  if (!Array.isArray(outputSchema) || !outputSchema.length) return warning("Output schema not defined");
  const mode = config.mode as string | undefined;
  const parts: string[] = [];
  if (mode === "multi_turn") parts.push("Multi Turn");
  if (model) parts.push(model);
  parts.push(`${outputSchema.length} fields`);
  return { text: parts.join(" \u00b7 ") || "Configured", isWarning: false };
}

// --- Formatter registry ---

const FORMATTERS: Record<string, (config: NodeConfig, context?: SummaryContext) => ConfigSummaryResult> = {
  if_else: ifElseSummary,
  switch: switchSummary,
  loop: loopSummary,
  variable_declaration: variableDeclarationSummary,
  variable_modification: variableModificationSummary,
  split: splitSummary,
  map: mapSummary,
  foreach: foreachSummary,
  merge: mergeSummary,
  filter: filterSummary,
  workflow: workflowSummary,
  http_request: httpRequestSummary,
  database_query: databaseQuerySummary,
  slack: slackSummary,
  send_email: sendEmailSummary,
  transform: transformSummary,
  code: codeSummary,
  carousel: carouselSummary,
  table: tableSummary,
  chart: chartSummary,
  form: formSummary,
  template: templateSummary,
  pdf: pdfSummary,
  ai_agent: aiAgentSummary,
  text_classifier: textClassifierSummary,
  information_extractor: informationExtractorSummary,
};

/** Returns a config summary for the given node type, or null if no summary applies (e.g. manual_trigger or unknown types). */
export function getConfigSummary(
  nodeType: string,
  config: NodeConfig,
  context?: SummaryContext,
): ConfigSummaryResult | null {
  if (nodeType === "manual_trigger") return null;

  const formatter = Object.hasOwn(FORMATTERS, nodeType) ? FORMATTERS[nodeType] : undefined;
  if (!formatter) return null;

  return formatter(config, context);
}

/** Truncates text to maxLen (default 40) with ellipsis. Returns whether truncation occurred. */
export function truncateSummary(
  text: string,
  maxLen = 40,
): { display: string; isTruncated: boolean } {
  if (text.length <= maxLen) return { display: text, isTruncated: false };
  return { display: text.slice(0, maxLen - 1) + "\u2026", isTruncated: true };
}
