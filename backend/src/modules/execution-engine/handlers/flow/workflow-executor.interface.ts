import { ExecutionStatus } from '../../../executions/entities/execution.entity.js';
import { ExecutionContext } from '../node-handler.interface.js';

export interface SubWorkflowOptions {
  parentExecutionId?: string;
  recursionDepth?: number;
  timeoutMs?: number;
}

export interface SubWorkflowResult {
  executionId: string;
  output: unknown;
  status: ExecutionStatus;
}

export interface InlineExecutionOptions {
  executionId: string;
  context: ExecutionContext;
  executedNodes: Set<string>;
  recursionDepth: number;
  /**
   * Stamp every NodeExecution produced by this inline run with this parent
   * id so the timeline can group children under the invoking Sub-Workflow
   * row. Normally the id of the `workflow` node's own NodeExecution.
   */
  parentNodeExecutionId?: string;
}

export interface WorkflowExecutor {
  /**
   * Execute a sub-workflow inline within the parent execution.
   * Nodes are executed under the same executionId and share the parent's
   * nodeOutputCache, so $node references and history timeline are seamless.
   */
  executeInline(
    workflowId: string,
    input: unknown,
    options: InlineExecutionOptions,
  ): Promise<unknown>;

  /**
   * Execute a sub-workflow asynchronously (fire-and-forget).
   * Creates a separate Execution record and returns its ID immediately.
   */
  executeAsync(
    workflowId: string,
    input: unknown,
    options?: Omit<SubWorkflowOptions, 'timeoutMs'>,
  ): Promise<string>;
}
