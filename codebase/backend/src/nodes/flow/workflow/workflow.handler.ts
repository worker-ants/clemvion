import {
  NodeHandler,
  NodeHandlerOutput,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  ErrorCode,
  ErrorCodeValue,
  truncateForErrorDetails,
} from '../../core/error-codes.js';
import { WorkflowExecutor } from '../../core/workflow-executor.interface.js';
import {
  WorkflowNotFoundError,
  SubWorkflowTimeoutError,
} from '../../../modules/execution-engine/workflow-errors.js';
import { workflowNodeMetadata } from './workflow.schema.js';
import { ParkReleaseSignal } from '../../../shared/execution-resume/park-release-signal.js';

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

    // 부모 workspace 컨텍스트 — 엔진의 workspace 격리 검증에 사용 (W-6).
    const parentWorkspaceId =
      (context.variables?.__workspaceId as string | undefined) || undefined;

    if (mode === 'async') {
      try {
        const subExecutionId = await this.executionEngine.executeAsync(
          workflowId,
          effectiveInput,
          {
            parentExecutionId: context.executionId,
            recursionDepth: currentDepth + 1,
            parentWorkspaceId,
          },
        );

        return {
          config: configEcho,
          output: {
            executionId: subExecutionId,
            workflowId,
            status: 'started',
          },
          status: 'started',
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

    // CONVENTIONS Principle 2 — `meta` carries execution metrics. We
    // measure inline run duration here (handler-side) since the engine
    // does not see the sub-workflow boundary. Wall-clock ms via Date.now
    // is intentionally good-enough — sub-millisecond precision is not
    // meaningful when the inline call runs through the full executor.
    const startedAt = Date.now();
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
          // exec-park D6 — 중첩 durable park 의 call-stack frame 키. 이 Workflow
          // 노드의 Node.id 를 invoker 로 기록해, sub-workflow 안의 blocking 노드가
          // park 하면 `resume_call_stack` 에 영속되고 §7.5 rehydration 이 부모
          // 그래프에서 이 노드까지 전진 후 재진입하는 데 쓴다.
          invokerNodeId: context.nodeId,
        },
      );
      const durationMs = Date.now() - startedAt;
      // Sync result is wrapped one level under `output.result` so every
      // sync termination follows the same shape regardless of the
      // sub-workflow's final node output. Downstream nodes access via
      // `$node["X"].output.result.<sub_path>`. Note: if the inner workflow
      // itself emits a `result` key, the access path becomes
      // `output.result.result` — an intentional double-nest, not a bug.
      return {
        config: configEcho,
        output: { result: inlineResult },
        meta: { durationMs },
      };
    } catch (err) {
      // exec-park D6 — sub-workflow 안의 blocking 노드가 durable release park 하면
      // executeInline 이 `ParkReleaseSignal` 을 throw 한다. 이는 런타임 실패가
      // 아니라 **park 신호**이므로 error 포트로 라우팅하면 안 된다 — 그대로 re-throw
      // 해 엔진(executeNode→runExecution/runNodeDispatchLoop)이 세그먼트를 종료하고
      // §7.5 rehydration 으로 재개하게 한다.
      if (err instanceof ParkReleaseSignal) {
        throw err;
      }
      return this.buildSubWorkflowError(configEcho, err);
    }
  }

  /**
   * CONVENTIONS §3.2 — a sub-workflow runtime failure is a runtime error,
   * not a pre-flight one, so it routes to the `error` port with a
   * standardized envelope rather than propagating the exception.
   *
   * Error code is mapped from the executor's thrown message; see
   * {@link mapSubWorkflowError}. The user-visible message is truncated to
   * keep error envelopes within reasonable size and to limit accidental
   * leaks of long internal stack frames or PII.
   */
  private buildSubWorkflowError(
    configEcho: Record<string, unknown>,
    err: unknown,
  ): {
    config: Record<string, unknown>;
    output: {
      error: {
        code: ErrorCodeValue;
        message: string;
        details?: Record<string, unknown>;
      };
    };
    port: 'error';
  } {
    const rawMessage = err instanceof Error ? err.message : String(err);
    const code = mapSubWorkflowError(err);
    const safeMessage = truncateForErrorDetails(rawMessage) ?? '';
    return {
      config: configEcho,
      output: {
        error: {
          code,
          message: safeMessage,
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

/**
 * Map a sub-workflow executor error to a CONVENTIONS §3.2 error code.
 * Exported for unit testing.
 *
 * **Primary**: `instanceof` 분기. `WorkflowExecutor` 구현이 typed error
 * (`WorkflowNotFoundError` / `SubWorkflowTimeoutError`) 를 throw 하면 본
 * 분기가 우선 매칭된다 — executor 메시지를 손대도 silent regression 이
 * 발생하지 않는다.
 *
 * **Fallback**: 메시지 부분문자열 매칭. 외부 throw (third-party executor
 * 어댑터 / queue layer / 옛 호출자) 가 plain `Error` 를 던질 때를 위한
 * defensive backstop. Queue 실패는 현재 typed error 가 없어 메시지 매칭만
 * 으로 매핑된다 (`SUB_WORKFLOW_QUEUE_FAILED`).
 *
 * 어느 분기도 매칭 안 되면 generic `SUB_WORKFLOW_FAILED`.
 *
 * @internal
 */
export function mapSubWorkflowError(err: unknown): ErrorCodeValue {
  if (err instanceof WorkflowNotFoundError) {
    return ErrorCode.SUB_WORKFLOW_NOT_FOUND;
  }
  if (err instanceof SubWorkflowTimeoutError) {
    return ErrorCode.SUB_WORKFLOW_TIMEOUT;
  }
  // Defensive backstop — 외부 executor / queue layer 가 plain Error 로 던진
  // 경우 메시지 토큰으로 분류. typed error 가 도입된 in-process executor
  // 에서는 도달하지 않는다.
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (lower.includes('workflow not found')) {
    return ErrorCode.SUB_WORKFLOW_NOT_FOUND;
  }
  // Match only the executor's actual phrasing
  // (`Sub-workflow execution timed out after Nms`). The bare token
  // "timeout" is intentionally rejected so unrelated inner-node errors
  // (e.g. "PostgreSQL connection timeout") do not get reclassified as
  // sub-workflow timeouts.
  if (lower.includes('timed out')) {
    return ErrorCode.SUB_WORKFLOW_TIMEOUT;
  }
  if (
    lower.includes('queue') &&
    (lower.includes('failed') ||
      lower.includes('enqueue') ||
      lower.includes('reject'))
  ) {
    return ErrorCode.SUB_WORKFLOW_QUEUE_FAILED;
  }
  return ErrorCode.SUB_WORKFLOW_FAILED;
}
