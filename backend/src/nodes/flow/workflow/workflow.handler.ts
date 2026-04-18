import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { WorkflowExecutor } from '../../core/workflow-executor.interface.js';

interface MappingDef {
  paramName: string;
  expression: unknown;
}

interface WorkflowConfig {
  workflowId: string;
  workflowName?: string;
  mode: 'sync' | 'async';
  inputMapping?: MappingDef[];
  timeout?: number;
}

const MAX_RECURSION_DEPTH = 10;

export class WorkflowHandler implements NodeHandler {
  constructor(private readonly executionEngine: WorkflowExecutor) {}

  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { workflowId, mode, timeout, inputMapping } =
      config as unknown as WorkflowConfig;

    if (!workflowId || typeof workflowId !== 'string') {
      errors.push('workflowId is required and must be a string');
    }

    if (mode && mode !== 'sync' && mode !== 'async') {
      errors.push('mode must be "sync" or "async"');
    }

    if (timeout !== undefined && (typeof timeout !== 'number' || timeout < 0)) {
      errors.push('timeout must be a non-negative number (0 = no timeout)');
    }

    if (inputMapping !== undefined) {
      if (!Array.isArray(inputMapping)) {
        errors.push('inputMapping must be an array');
      } else {
        for (let i = 0; i < inputMapping.length; i++) {
          const mapping = inputMapping[i];
          if (!mapping.paramName || typeof mapping.paramName !== 'string') {
            errors.push(
              `inputMapping[${i}].paramName is required and must be a string`,
            );
          }
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const {
      workflowId,
      mode = 'sync',
      inputMapping = [],
    } = config as unknown as WorkflowConfig;

    // Recursion depth check
    const currentDepth = context.recursionDepth ?? 0;
    if (currentDepth >= MAX_RECURSION_DEPTH) {
      throw new Error(
        `Maximum recursion depth exceeded (limit: ${MAX_RECURSION_DEPTH})`,
      );
    }

    // Build sub-workflow input from inputMapping
    // Expression values are already resolved by ExecutionEngineService
    const subInput: Record<string, unknown> = {};
    for (const mapping of inputMapping) {
      subInput[mapping.paramName] = mapping.expression;
    }

    // If no inputMapping, pass the parent input through
    const effectiveInput =
      inputMapping.length > 0 ? subInput : (input as Record<string, unknown>);

    if (mode === 'async') {
      const subExecutionId = await this.executionEngine.executeAsync(
        workflowId,
        effectiveInput,
        {
          parentExecutionId: context.executionId,
          recursionDepth: currentDepth + 1,
        },
      );

      return {
        config: { workflowId, mode: 'async' },
        output: { executionId: subExecutionId },
        meta: { status: 'started' },
      };
    }

    // Sync mode: execute inline within the same execution context.
    // Sub-workflow nodes share the parent's executionId so they appear
    // in the same history timeline. $node references resolve against
    // the target workflow's own nodes only.
    if (!context._executedNodes) {
      throw new Error('Inline execution requires _executedNodes in context');
    }

    const inlineResult = await this.executionEngine.executeInline(
      workflowId,
      effectiveInput,
      {
        executionId: context.executionId,
        context,
        executedNodes: context._executedNodes,
        recursionDepth: currentDepth + 1,
        // Tag every NodeExecution produced by this inline run with the
        // workflow node's own row id, so the frontend timeline can render a
        // Sub-Workflow card grouping its children.
        parentNodeExecutionId: context.nodeExecutionId,
      },
    );
    return {
      config: { workflowId, mode: 'sync' },
      output: inlineResult,
    };
  }
}
