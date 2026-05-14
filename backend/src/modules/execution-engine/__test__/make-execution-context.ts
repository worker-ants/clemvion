import { ExecutionContext } from '../../../nodes/core/node-handler.interface';
import { createEmptyConversationThread } from '../../../shared/conversation-thread/conversation-thread.types';

/**
 * Canonical test factory for `ExecutionContext`. Use this in every spec that
 * needs a context — that way each new required field on `ExecutionContext`
 * (e.g. `conversationThread` from this round) only requires updating the
 * factory in one place instead of patching 30+ spec files.
 *
 * Pass `overrides` for any field the test cares about; everything else gets
 * a sensible empty default.
 *
 * @example
 *   const ctx = makeExecutionContext({
 *     executionId: 'exec-1',
 *     variables: { __workspaceId: 'ws-1' },
 *   });
 */
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
