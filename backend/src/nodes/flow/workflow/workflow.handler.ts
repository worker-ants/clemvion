import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { WorkflowExecutor } from '../../core/workflow-executor.interface.js';
import { workflowNodeMetadata } from './workflow.schema.js';

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
  metadata = workflowNodeMetadata;

  constructor(private readonly executionEngine: WorkflowExecutor) {}

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers workflowId-required +
    // timeout numeric range + inputMapping per-item paramName. The mode enum
    // guard remains handler-side as a defensive check for direct callers.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { mode, workflowId } = config as unknown as WorkflowConfig;
    if (workflowId !== undefined && typeof workflowId !== 'string') {
      errors.push('workflowId is required and must be a string');
    }
    if (mode && mode !== 'sync' && mode !== 'async') {
      errors.push('mode must be "sync" or "async"');
    }
    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> {
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

    // CONVENTIONS Principle 7 — config echoes raw workflowId / mode /
    // inputMapping (`mapping.expression` may be a `{{ ... }}` template that
    // the engine resolved before dispatch). The runtime sub-input above
    // uses the evaluated values from the resolved `config`.
    const rawConfig = (context.rawConfig ??
      config) as unknown as WorkflowConfig;
    const configEcho = {
      workflowId: rawConfig.workflowId,
      workflowName: rawConfig.workflowName,
      mode: rawConfig.mode ?? 'sync',
      inputMapping: rawConfig.inputMapping,
      timeout: rawConfig.timeout,
    };

    if (mode === 'async') {
      try {
        const subExecutionId = await this.executionEngine.executeAsync(
          workflowId,
          effectiveInput,
          {
            parentExecutionId: context.executionId,
            recursionDepth: currentDepth + 1,
          },
        );

        return {
          config: configEcho,
          output: { executionId: subExecutionId },
          meta: { status: 'started' },
        };
      } catch (err) {
        return this.buildSubWorkflowError(configEcho, err);
      }
    }

    // Sync mode: execute inline within the same execution context.
    // Sub-workflow nodes share the parent's executionId so they appear
    // in the same history timeline. $node references resolve against
    // the target workflow's own nodes only.
    if (!context._executedNodes) {
      throw new Error('Inline execution requires _executedNodes in context');
    }

    try {
      const inlineResult = await this.executionEngine.executeInline(
        workflowId,
        effectiveInput,
        {
          executionId: context.executionId,
          context,
          executedNodes: context._executedNodes,
          recursionDepth: currentDepth + 1,
          // Tag every NodeExecution produced by this inline run with the
          // workflow node's own row id, so the frontend timeline can render
          // a Sub-Workflow card grouping its children.
          parentNodeExecutionId: context.nodeExecutionId,
        },
      );
      return {
        config: configEcho,
        output: inlineResult,
      };
    } catch (err) {
      return this.buildSubWorkflowError(configEcho, err);
    }
  }

  /**
   * CONVENTIONS §3.2 — a sub-workflow runtime failure is a runtime error,
   * not a pre-flight one, so it routes to the `error` port with a
   * standardized envelope rather than propagating the exception.
   */
  private buildSubWorkflowError(
    configEcho: Record<string, unknown>,
    err: unknown,
  ): {
    config: Record<string, unknown>;
    output: {
      error: {
        code: string;
        message: string;
        details?: Record<string, unknown>;
      };
    };
    port: 'error';
  } {
    const message = err instanceof Error ? err.message : String(err);
    return {
      config: configEcho,
      output: {
        error: {
          code: 'SUB_WORKFLOW_FAILED',
          message,
          details: {
            workflowId: configEcho.workflowId,
            mode: configEcho.mode,
          },
        },
      },
      port: 'error',
    };
  }
}
