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

// Integration handlers

// Data handlers

// Presentation handlers
export { CarouselHandler } from './presentation/carousel.handler.js';
export { TableHandler } from './presentation/table.handler.js';
export { ChartHandler } from './presentation/chart.handler.js';
export { FormHandler } from './presentation/form.handler.js';
export { TemplateHandler } from './presentation/template.handler.js';

// Trigger handlers

// AI handlers

// Interfaces
export type {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../../nodes/core/node-handler.interface.js';

// Utilities
export {
  getNestedValue,
  setNestedValue,
} from '../../../nodes/core/nested-value.util.js';
