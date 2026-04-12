// Logic handlers
export { IfElseHandler } from './logic/if-else.handler.js';
export { SwitchHandler } from './logic/switch.handler.js';
export { LoopHandler } from './logic/loop.handler.js';
export { VariableDeclarationHandler } from './logic/variable-declaration.handler.js';
export { VariableModificationHandler } from './logic/variable-modification.handler.js';
export { SplitHandler } from './logic/split.handler.js';
export { MapHandler } from './logic/map.handler.js';
export { ForEachHandler } from './logic/foreach.handler.js';
export { MergeHandler } from './logic/merge.handler.js';
export { FilterHandler } from './logic/filter.handler.js';

// Flow handlers
export { WorkflowHandler } from './flow/workflow.handler.js';

// Integration handlers
export { HttpRequestHandler } from './integration/http-request.handler.js';
export { DatabaseQueryHandler } from './integration/database-query.handler.js';
export { SlackHandler } from './integration/slack.handler.js';
export { SendEmailHandler } from './integration/send-email.handler.js';

// Data handlers
export { TransformHandler } from './data/transform.handler.js';
export { CodeHandler } from './data/code.handler.js';

// Presentation handlers
export { CarouselHandler } from './presentation/carousel.handler.js';
export { TableHandler } from './presentation/table.handler.js';
export { ChartHandler } from './presentation/chart.handler.js';
export { FormHandler } from './presentation/form.handler.js';
export { TemplateHandler } from './presentation/template.handler.js';
export { PdfHandler } from './presentation/pdf.handler.js';

// Trigger handlers
export { ManualTriggerHandler } from './trigger/manual-trigger.handler.js';

// AI handlers
export { AiAgentHandler } from './ai/ai-agent.handler.js';
export { TextClassifierHandler } from './ai/text-classifier.handler.js';
export { InformationExtractorHandler } from './ai/information-extractor.handler.js';

// Interfaces
export type {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from './node-handler.interface.js';

// Utilities
export { getNestedValue, setNestedValue } from './logic/nested-value.util.js';
