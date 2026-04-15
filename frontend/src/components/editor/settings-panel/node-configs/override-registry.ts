import type { ComponentType } from "react";

// Logic
import {
  IfElseConfig,
  SwitchConfig,
  LoopConfig,
  VariableDeclarationConfig,
  VariableModificationConfig,
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
} from "./presentation-configs";

// Trigger
import { ManualTriggerConfig } from "./trigger-configs";

type ConfigProps = {
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
};

/**
 * Node types that have custom config UIs that should NOT be replaced by the
 * schema-driven auto-form. When the underlying zod schema + widget registry
 * becomes expressive enough for a given node, remove its entry from this map
 * and the auto-form will take over.
 */
export const OVERRIDE_REGISTRY: Record<string, ComponentType<ConfigProps>> = {
  // Trigger
  manual_trigger: ManualTriggerConfig,
  // Logic
  if_else: IfElseConfig,
  switch: SwitchConfig,
  loop: LoopConfig,
  variable_declaration: VariableDeclarationConfig,
  variable_modification: VariableModificationConfig,
  // `split`, `map`, `foreach`, `merge` are migrated to auto-form (schema-driven).
  filter: FilterConfig,
  // Flow
  workflow: WorkflowConfig,
  // AI
  ai_agent: AiAgentConfig,
  text_classifier: TextClassifierConfig,
  information_extractor: InformationExtractorConfig,
  // Integration
  http_request: HttpRequestConfig,
  database_query: DatabaseQueryConfig,
  slack: SlackConfig,
  send_email: SendEmailConfig,
  // Data
  transform: TransformConfig,
  code: CodeConfig,
  // Presentation
  carousel: CarouselConfig,
  table: TableConfig,
  chart: ChartConfig,
  form: FormConfig,
  template: TemplateConfig,
  // `pdf` is migrated to auto-form (schema-driven).
};
