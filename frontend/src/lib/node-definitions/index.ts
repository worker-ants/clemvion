export type PortDefinition = {
  id: string;
  label: string;
  type: "data" | "error";
};

export type NodeDefinition = {
  type: string;
  category: "trigger" | "logic" | "flow" | "ai" | "integration" | "data" | "presentation";
  label: string;
  description: string;
  icon: string;
  color: string;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  isContainer?: boolean;
  defaultConfig?: Record<string, unknown>;
};

export const CATEGORY_COLORS: Record<string, string> = {
  trigger: "#F59E0B",
  logic: "#3B82F6",
  flow: "#8B5CF6",
  ai: "#10B981",
  integration: "#F97316",
  data: "#06B6D4",
  presentation: "#EC4899",
};

export const NODE_DEFINITIONS: NodeDefinition[] = [
  // ===== TRIGGER (1) =====
  { type: "manual_trigger", category: "trigger", label: "Manual Trigger", description: "Start point for manual workflow execution", icon: "Zap", color: CATEGORY_COLORS.trigger, inputs: [], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { parameters: [] } },

  // ===== LOGIC (9) =====
  { type: "if_else", category: "logic", label: "If/Else", description: "Conditional branching", icon: "GitBranch", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "true", label: "True", type: "data" }, { id: "false", label: "False", type: "data" }], defaultConfig: { conditions: [], combineMode: "and", strictComparison: false } },
  { type: "switch", category: "logic", label: "Switch", description: "Multi-path branching", icon: "Route", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [], defaultConfig: { mode: "value", cases: [], hasDefault: false, strictComparison: false } },
  { type: "loop", category: "logic", label: "Loop", description: "Repeat N times", icon: "Repeat", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }, { id: "emit", label: "Emit", type: "data" }], outputs: [{ id: "body", label: "Body", type: "data" }, { id: "done", label: "Done", type: "data" }], isContainer: true, defaultConfig: { count: 1, maxIterations: 1000 } },
  { type: "variable_declaration", category: "logic", label: "Variable", description: "Declare variables", icon: "Variable", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { variables: [] } },
  { type: "variable_modification", category: "logic", label: "Set Variable", description: "Modify variables", icon: "PenLine", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { modifications: [] } },
  { type: "split", category: "logic", label: "Split", description: "Split array items", icon: "Split", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "map", category: "logic", label: "Map", description: "Transform array items via body subgraph", icon: "Map", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }, { id: "emit", label: "Emit", type: "data" }], outputs: [{ id: "body", label: "Body", type: "data" }, { id: "done", label: "Done", type: "data" }], isContainer: true, defaultConfig: { errorPolicy: "stop" } },
  { type: "foreach", category: "logic", label: "ForEach", description: "Iterate over array", icon: "ListOrdered", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }, { id: "emit", label: "Emit", type: "data" }], outputs: [{ id: "body", label: "Body", type: "data" }, { id: "done", label: "Done", type: "data" }], isContainer: true, defaultConfig: { errorPolicy: "stop" } },
  { type: "merge", category: "logic", label: "Merge", description: "Combine inputs", icon: "Merge", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { strategy: "wait_all", outputFormat: "array", timeout: 300, partialOnTimeout: false } },
  { type: "filter", category: "logic", label: "Filter", description: "Filter array by conditions", icon: "Filter", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "match", label: "Match", type: "data" }, { id: "unmatched", label: "Unmatched", type: "data" }], defaultConfig: { conditions: [], combineMode: "and", strictComparison: false } },

  // ===== FLOW (1) =====
  { type: "workflow", category: "flow", label: "Sub-Workflow", description: "Call another workflow", icon: "Workflow", color: CATEGORY_COLORS.flow, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { mode: "sync", inputMapping: [], timeout: 300 } },

  // ===== AI (3) =====
  { type: "ai_agent", category: "ai", label: "AI Agent", description: "Chat with LLM using RAG context", icon: "Brain", color: CATEGORY_COLORS.ai, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { mode: "single_turn", responseFormat: "text", knowledgeBases: [], ragTopK: 5, ragThreshold: 0.7, toolNodeIds: [], toolOverrides: [], maxToolCalls: 10, conversationHistory: "none", maxTurns: 20, conditions: [] } },
  { type: "text_classifier", category: "ai", label: "Text Classifier", description: "Classify text into categories", icon: "Tags", color: CATEGORY_COLORS.ai, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [], defaultConfig: { categories: [], includeConfidence: false } },
  { type: "information_extractor", category: "ai", label: "Information Extractor", description: "Extract structured data from text", icon: "FileSearch", color: CATEGORY_COLORS.ai, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }, { id: "error", label: "Error", type: "error" }], defaultConfig: { outputSchema: [], examples: [], mode: "single_turn", maxTurns: 10 } },

  // ===== INTEGRATION (4) =====
  { type: "http_request", category: "integration", label: "HTTP Request", description: "Make HTTP requests", icon: "Globe", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "success", label: "Success", type: "data" }, { id: "error", label: "Error", type: "error" }], defaultConfig: { method: "GET", authentication: "none", headers: [], queryParams: [], bodyType: "json", responseType: "json", timeout: 30000, followRedirects: true, verifySsl: true } },
  { type: "database_query", category: "integration", label: "Database", description: "Execute SQL queries", icon: "Database", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { parameters: [], queryType: "select" } },
  { type: "slack", category: "integration", label: "Slack", description: "Send Slack messages", icon: "MessageSquare", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { action: "send_message" } },
  { type: "send_email", category: "integration", label: "Send Email", description: "Send emails via SMTP", icon: "Mail", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { to: [], cc: [], bcc: [], bodyType: "text", attachments: [] } },

  // ===== DATA (2) =====
  { type: "transform", category: "data", label: "Transform", description: "Transform data", icon: "ArrowRightLeft", color: CATEGORY_COLORS.data, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { operations: [] } },
  { type: "code", category: "data", label: "Code", description: "Run JavaScript code", icon: "Code", color: CATEGORY_COLORS.data, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { language: "javascript" } },

  // ===== PRESENTATION (6) =====
  { type: "carousel", category: "presentation", label: "Carousel", description: "Display as slides", icon: "GalleryHorizontal", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { mode: "dynamic", items: [], maxItems: 10, layout: "card", itemButtons: [], buttons: [] } },
  { type: "table", category: "presentation", label: "Table", description: "Display as table", icon: "Table", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { mode: "dynamic", columns: [], rows: [], pagination: true, pageSize: 20, sortOrder: "asc", buttons: [] } },
  { type: "chart", category: "presentation", label: "Chart", description: "Visualize as chart", icon: "BarChart3", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { chartType: "bar", xAxis: { field: "" }, yAxis: { field: "" }, buttons: [] } },
  { type: "form", category: "presentation", label: "Form", description: "User input form", icon: "FileInput", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { fields: [], submitButtonLabel: "Submit", buttons: [] } },
  { type: "template", category: "presentation", label: "Template", description: "Render templates", icon: "FileText", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "pdf", category: "presentation", label: "PDF", description: "Generate PDF documents", icon: "FileDown", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }], defaultConfig: { timeout: 60 } },
];

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return NODE_DEFINITIONS.find((n) => n.type === type);
}

export function getNodesByCategory(category: string): NodeDefinition[] {
  return NODE_DEFINITIONS.filter((n) => n.category === category);
}

export const CATEGORIES = [
  { id: "trigger", label: "Trigger", icon: "Zap" },
  { id: "logic", label: "Logic", icon: "GitBranch" },
  { id: "flow", label: "Flow", icon: "Workflow" },
  { id: "ai", label: "AI", icon: "Sparkles" },
  { id: "integration", label: "Integration", icon: "Puzzle" },
  { id: "data", label: "Data", icon: "Database" },
  { id: "presentation", label: "Presentation", icon: "Layout" },
] as const;
