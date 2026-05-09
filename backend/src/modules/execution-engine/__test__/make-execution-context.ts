import { ExecutionContext } from '../../../nodes/core/node-handler.interface';

export function makeExecutionContext(
  overrides: Partial<ExecutionContext> = {},
): ExecutionContext {
  return {
    executionId: 'test-execution',
    workflowId: 'test-workflow',
    variables: {},
    nodeOutputCache: {},
    structuredOutputCache: {},
    engineResolvedConfigCache: {},
    recursionDepth: 0,
    ...overrides,
  };
}
