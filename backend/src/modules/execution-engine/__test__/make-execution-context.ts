import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import { createEmptyConversationThread } from '../conversation-thread/conversation-thread.types';

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
    conversationThread: createEmptyConversationThread(),
    ...overrides,
  };
}
