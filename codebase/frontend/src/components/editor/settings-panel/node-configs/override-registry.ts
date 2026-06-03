import type { ComponentType } from "react";

// Logic
import {
  IfElseConfig,
  SwitchConfig,
  LoopConfig,
  VariableDeclarationConfig,
  VariableModificationConfig,
  FilterConfig,
  ParallelConfig,
} from "./logic-configs";

// Flow
import { WorkflowConfig } from "./flow-configs";

// AI
import {
  TextClassifierConfig,
  InformationExtractorConfig,
} from "./ai-configs";

// Integration
import {
  HttpRequestConfig,
  DatabaseQueryConfig,
  SendEmailConfig,
  Cafe24Config,
  MakeshopConfig,
} from "./integration-configs";

// Data
import { TransformConfig, CodeConfig } from "./data-configs";

// Presentation
import {
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
  parallel: ParallelConfig,
  filter: FilterConfig,
  // Flow
  workflow: WorkflowConfig,
  // AI — ai_agent migrated to auto-form (schema-driven)
  text_classifier: TextClassifierConfig,
  information_extractor: InformationExtractorConfig,
  // Integration
  http_request: HttpRequestConfig,
  database_query: DatabaseQueryConfig,
  send_email: SendEmailConfig,
  cafe24: Cafe24Config,
  makeshop: MakeshopConfig,
  // Data
  transform: TransformConfig,
  code: CodeConfig,
  // Presentation — carousel migrated to auto-form (schema-driven)
  // table: kept as override — column/row sync requires cross-field side effects
  table: TableConfig,
  chart: ChartConfig,
  form: FormConfig,
  template: TemplateConfig,
};
