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
  { type: "manual_trigger", category: "trigger", label: "Manual Trigger", description: "Start point for manual workflow execution", icon: "Zap", color: CATEGORY_COLORS.trigger, inputs: [], outputs: [{ id: "out", label: "Output", type: "data" }] },

  // ===== LOGIC (9) =====
  { type: "if_else", category: "logic", label: "If/Else", description: "Conditional branching", icon: "GitBranch", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "true", label: "True", type: "data" }, { id: "false", label: "False", type: "data" }] },
  { type: "switch", category: "logic", label: "Switch", description: "Multi-path branching", icon: "Route", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [] },
  { type: "loop", category: "logic", label: "Loop", description: "Repeat N times", icon: "Repeat", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "body", label: "Body", type: "data" }, { id: "done", label: "Done", type: "data" }], isContainer: true },
  { type: "variable_declaration", category: "logic", label: "Variable", description: "Declare variables", icon: "Variable", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "variable_modification", category: "logic", label: "Set Variable", description: "Modify variables", icon: "PenLine", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "split", category: "logic", label: "Split", description: "Split array items", icon: "Split", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "map", category: "logic", label: "Map", description: "Transform array items", icon: "Map", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "foreach", category: "logic", label: "ForEach", description: "Iterate over array", icon: "ListOrdered", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "body", label: "Body", type: "data" }, { id: "done", label: "Done", type: "data" }], isContainer: true },
  { type: "merge", category: "logic", label: "Merge", description: "Combine inputs", icon: "Merge", color: CATEGORY_COLORS.logic, inputs: [{ id: "in_0", label: "Input 1", type: "data" }, { id: "in_1", label: "Input 2", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "filter", category: "logic", label: "Filter", description: "Filter array by conditions", icon: "Filter", color: CATEGORY_COLORS.logic, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "match", label: "Match", type: "data" }, { id: "unmatched", label: "Unmatched", type: "data" }] },

  // ===== FLOW (1) =====
  { type: "workflow", category: "flow", label: "Sub-Workflow", description: "Call another workflow", icon: "Workflow", color: CATEGORY_COLORS.flow, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },

  // ===== AI (3) =====
  { type: "ai_agent", category: "ai", label: "AI Agent", description: "Chat with LLM using RAG context", icon: "Brain", color: CATEGORY_COLORS.ai, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "text_classifier", category: "ai", label: "Text Classifier", description: "Classify text into categories", icon: "Tags", color: CATEGORY_COLORS.ai, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "class_0", label: "Class 1", type: "data" }, { id: "class_1", label: "Class 2", type: "data" }, { id: "fallback", label: "Fallback", type: "data" }] },
  { type: "information_extractor", category: "ai", label: "Information Extractor", description: "Extract structured data from text", icon: "FileSearch", color: CATEGORY_COLORS.ai, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },

  // ===== INTEGRATION (4) =====
  { type: "http_request", category: "integration", label: "HTTP Request", description: "Make HTTP requests", icon: "Globe", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "success", label: "Success", type: "data" }, { id: "error", label: "Error", type: "error" }] },
  { type: "database_query", category: "integration", label: "Database", description: "Execute SQL queries", icon: "Database", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "slack", category: "integration", label: "Slack", description: "Send Slack messages", icon: "MessageSquare", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "send_email", category: "integration", label: "Send Email", description: "Send emails via SMTP", icon: "Mail", color: CATEGORY_COLORS.integration, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },

  // ===== DATA (2) =====
  { type: "transform", category: "data", label: "Transform", description: "Transform data", icon: "ArrowRightLeft", color: CATEGORY_COLORS.data, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "code", category: "data", label: "Code", description: "Run JavaScript code", icon: "Code", color: CATEGORY_COLORS.data, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },

  // ===== PRESENTATION (6) =====
  { type: "carousel", category: "presentation", label: "Carousel", description: "Display as slides", icon: "GalleryHorizontal", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "table", category: "presentation", label: "Table", description: "Display as table", icon: "Table", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "chart", category: "presentation", label: "Chart", description: "Visualize as chart", icon: "BarChart3", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "form", category: "presentation", label: "Form", description: "User input form", icon: "FileInput", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "template", category: "presentation", label: "Template", description: "Render templates", icon: "FileText", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
  { type: "pdf", category: "presentation", label: "PDF", description: "Generate PDF documents", icon: "FileDown", color: CATEGORY_COLORS.presentation, inputs: [{ id: "in", label: "Input", type: "data" }], outputs: [{ id: "out", label: "Output", type: "data" }] },
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
