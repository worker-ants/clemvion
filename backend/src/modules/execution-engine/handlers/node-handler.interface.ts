export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  /** Current NodeExecution row id — set by the engine before each handler call. */
  nodeExecutionId?: string;
  variables: Record<string, unknown>;
  nodeOutputCache: Record<string, unknown>;
  /**
   * Per-node {@link NodeHandlerOutput} view. Populated in parallel with
   * `nodeOutputCache` by the engine after each handler call. Expression
   * resolver reads from this cache to expose `$node[X].config / .output /
   * .meta / .port / .status`. Optional for backward compatibility with
   * existing test fixtures that don't pre-populate it.
   */
  structuredOutputCache?: Record<string, NodeHandlerOutput>;
  loopContext?: {
    index: number;
    count: number;
    isFirst: boolean;
    isLast: boolean;
  };
  itemContext?: {
    item: unknown;
    index: number;
    isFirst: boolean;
    isLast: boolean;
  };
  expressionContext?: Record<string, unknown>;
  recursionDepth?: number;
  /**
   * When set, the engine will persist every NodeExecution created under this
   * context with `parent_node_execution_id = this value`. Stamped by
   * WorkflowHandler before an inline sub-workflow run so children can be
   * grouped under their invoking Sub-Workflow row in the run-results
   * timeline. Must be restored to the prior value on inline-run return so
   * sibling nodes don't inherit it.
   */
  parentNodeExecutionId?: string;
  /** Runtime state injected by ExecutionEngineService for sub-workflow inline execution */
  _executedNodes?: Set<string>;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * Unified handler return shape.
 *
 * - `config` — the resolved input settings for debugging / audit / downstream
 *   reference via `$node["<label>"].config.<field>`. Credential material
 *   (tokens, passwords, api_keys) MUST be stripped before returning.
 * - `output` — the primary produced value consumed by downstream nodes.
 *   Shape is domain-specific (array, object, primitive). Exposed as
 *   `$node["<label>"].output.<field>`.
 * - `meta` — optional execution metadata (durationMs, statusCode, tokensUsed,
 *   etc.). Exposed as `$node["<label>"].meta.<field>`.
 * - `port` — optional routing directive; the engine forwards only edges that
 *   match this port. May be a `string[]` to activate multiple output ports
 *   simultaneously (e.g. multi-label classification).
 * - `status` — optional flow-control directive (`waiting_for_input`,
 *   `requires_integration`, `requires_playwright`).
 */
export interface NodeHandlerOutput {
  config: Record<string, unknown>;
  output: unknown;
  meta?: Record<string, unknown>;
  port?: string | string[];
  status?: string;
}

export interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput | unknown>;
}
