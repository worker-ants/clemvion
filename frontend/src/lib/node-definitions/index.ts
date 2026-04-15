export type {
  PortDefinition,
  NodeCategory,
  NodeDefinition,
  NodeMetadata,
  NodeDefinitionResponse,
  JsonSchemaNode,
  UiHint,
  UiWidget,
} from "./types";

export {
  getNodeDefinition,
  getAllNodeDefinitions,
  getNodesByCategory,
  loadNodeDefinitions,
  useNodeDefinitionsStore,
} from "@/lib/stores/node-definitions-store";

export const CATEGORY_COLORS: Record<string, string> = {
  trigger: "#F59E0B",
  logic: "#3B82F6",
  flow: "#8B5CF6",
  ai: "#10B981",
  integration: "#F97316",
  data: "#06B6D4",
  presentation: "#EC4899",
};

export const CATEGORIES = [
  { id: "trigger", label: "Trigger", icon: "Zap" },
  { id: "logic", label: "Logic", icon: "GitBranch" },
  { id: "flow", label: "Flow", icon: "Workflow" },
  { id: "ai", label: "AI", icon: "Sparkles" },
  { id: "integration", label: "Integration", icon: "Puzzle" },
  { id: "data", label: "Data", icon: "Database" },
  { id: "presentation", label: "Presentation", icon: "Layout" },
] as const;
