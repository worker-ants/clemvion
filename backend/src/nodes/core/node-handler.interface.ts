export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  /**
   * The logical node id (graph node UUID) for the handler invocation. Distinct
   * from {@link nodeExecutionId}, which is the per-row identifier — handlers
   * use this when emitting WS events that must be addressable by the static
   * graph node (e.g. AI Agent's tool_call_started/completed).
   *
   * Set by the engine before each handler call. May be absent in legacy
   * resume state captured before this field existed; consumers should
   * fall back to `''` and skip the side-effect rather than throw.
   */
  nodeId?: string;
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
  /**
   * 노드 정의에 저장된 **원본 config** (expression 평가 전). 핸들러가
   * `NodeHandlerOutput.config` echo 에 사용한다 — `config` 인자는 평가 후 값
   * 이고, 본 필드는 워크플로 작성자가 입력한 raw 형태(`{{ ... }}` 포함) 그대로다.
   *
   * 엔진이 매 노드 호출 직전에 `Object.freeze` 적용한 shallow snapshot 을
   * 주입한다. **Shallow freeze 임에 유의** — top-level 필드 mutation 은 strict
   * 모드에서 TypeError 가 발생하지만, `rawConfig.headers.foo = '...'` 같은
   * 중첩 객체 변이는 차단되지 않는다. 핸들러는 rawConfig 를 read-only 로
   * 다루어야 하며, 변형이 필요한 경우 `structuredClone` 등으로 복제한다.
   *
   * 상세: PRD `ENG-RC-*`, Spec `4-execution-engine.md` §5.5 / §6.1,
   * CONVENTIONS Principle 7.
   */
  rawConfig?: Readonly<Record<string, unknown>>;
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
  /**
   * Engine-internal resume continuation state (CONVENTIONS §4.3). Populated
   * by multi-turn handlers (ai_agent, information_extractor) when they
   * return `status: 'waiting_for_input'` — the engine passes it back in on
   * the next user message. Deliberately outside `output` so expression
   * resolver and UI autocomplete don't surface it to workflow authors.
   *
   * Non-resumable handlers should omit this field entirely — it's declared
   * `?` here (rather than pushed onto a separate subtype) because adapter,
   * flat-cache conversion, and engine resume lookup all need a single
   * pass-through type. See {@link ResumableNodeHandlerOutput} for a
   * narrowing helper.
   */
  _resumeState?: Record<string, unknown>;
}

/**
 * Sub-type for handlers that DO emit resume state (multi-turn LLM nodes).
 * Use in handler return signatures and test fixtures to assert
 * `_resumeState` is present without having to guard against `undefined`.
 */
export interface ResumableNodeHandlerOutput extends NodeHandlerOutput {
  _resumeState: Record<string, unknown>;
  status: 'waiting_for_input';
}

export interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput> | Promise<unknown>;
}
