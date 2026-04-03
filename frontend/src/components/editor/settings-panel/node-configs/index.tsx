"use client";

// Logic
import {
  IfElseConfig,
  SwitchConfig,
  LoopConfig,
  VariableDeclarationConfig,
  VariableModificationConfig,
  SplitConfig,
  MapConfig,
  ForEachConfig,
  MergeConfig,
  FilterConfig,
} from "./logic-configs";

// Flow
import { WorkflowConfig } from "./flow-configs";

// AI
import {
  AiAgentConfig,
  TextClassifierConfig,
  InformationExtractorConfig,
} from "./ai-configs";

// Integration
import {
  HttpRequestConfig,
  DatabaseQueryConfig,
  SlackConfig,
  SendEmailConfig,
} from "./integration-configs";

// Data
import { TransformConfig, CodeConfig } from "./data-configs";

// Presentation
import {
  CarouselConfig,
  TableConfig,
  ChartConfig,
  FormConfig,
  TemplateConfig,
  PdfConfig,
} from "./presentation-configs";

type NodeConfigProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

// Stable wrapper component that renders the correct config form for a given node type
export function NodeConfigRenderer({
  nodeType,
  config,
  onChange,
}: NodeConfigProps & { nodeType: string }) {
  const props = { config, onChange };

  switch (nodeType) {
    // Logic
    case "if_else":
      return <IfElseConfig {...props} />;
    case "switch":
      return <SwitchConfig {...props} />;
    case "loop":
      return <LoopConfig {...props} />;
    case "variable_declaration":
      return <VariableDeclarationConfig {...props} />;
    case "variable_modification":
      return <VariableModificationConfig {...props} />;
    case "split":
      return <SplitConfig {...props} />;
    case "map":
      return <MapConfig {...props} />;
    case "foreach":
      return <ForEachConfig {...props} />;
    case "merge":
      return <MergeConfig {...props} />;
    case "filter":
      return <FilterConfig {...props} />;
    // Flow
    case "workflow":
      return <WorkflowConfig {...props} />;
    // AI
    case "ai_agent":
      return <AiAgentConfig {...props} />;
    case "text_classifier":
      return <TextClassifierConfig {...props} />;
    case "information_extractor":
      return <InformationExtractorConfig {...props} />;
    // Integration
    case "http_request":
      return <HttpRequestConfig {...props} />;
    case "database_query":
      return <DatabaseQueryConfig {...props} />;
    case "slack":
      return <SlackConfig {...props} />;
    case "send_email":
      return <SendEmailConfig {...props} />;
    // Data
    case "transform":
      return <TransformConfig {...props} />;
    case "code":
      return <CodeConfig {...props} />;
    // Presentation
    case "carousel":
      return <CarouselConfig {...props} />;
    case "table":
      return <TableConfig {...props} />;
    case "chart":
      return <ChartConfig {...props} />;
    case "form":
      return <FormConfig {...props} />;
    case "template":
      return <TemplateConfig {...props} />;
    case "pdf":
      return <PdfConfig {...props} />;
    default:
      return null;
  }
}
