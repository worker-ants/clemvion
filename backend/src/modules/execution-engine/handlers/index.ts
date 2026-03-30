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

// Flow handlers
export { WorkflowHandler } from './flow/workflow.handler.js';

// Interfaces
export type {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from './node-handler.interface.js';

// Utilities
export { getNestedValue, setNestedValue } from './logic/nested-value.util.js';
