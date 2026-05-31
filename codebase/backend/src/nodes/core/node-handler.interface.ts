import type { ConversationThread } from '../../shared/conversation-thread/conversation-thread.types';

export interface ExecutionContext {
  executionId: string;
  workflowId: string;
  /**
   * The logical node id (graph node UUID) for the handler invocation. Distinct
   * from {@link nodeExecutionId}, which is the per-row identifier — handlers
   * use this when emitting WS events that must be addressable by the static
   * graph node (e.g. AI Agent's tool_call_started/completed).
   *
   * 엔진이 dispatch 직전 항상 주입한다. `?` 표기는 핸들러를 `executeNode`
   * 경유 없이 직접 unit test 하는 fixture 가 생략을 허용하기 위함.
   * Legacy resume state captured before this field existed 의 경우에도
   * absent 가능 — consumers should fall back to `''` and skip the
   * side-effect rather than throw.
   */
  nodeId?: string;
  /**
   * Current NodeExecution row id — 엔진이 dispatch 직전 항상 주입한다.
   * `?` 표기는 핸들러를 직접 unit test 하는 fixture 가 생략을 허용하기 위함.
   */
  nodeExecutionId?: string;
  /**
   * 워크플로 작성자가 노드에 지정한 label. 엔진이 dispatch 직전 nodeId 와 함께
   * 주입한다. AI 노드의 System Context Prefix (`node` 섹션) 가 `node.label ?? ''`
   * 폴백을 위해 사용. 직접 unit test 하는 fixture 는 생략 허용.
   */
  nodeLabel?: string;
  /**
   * Node type 식별자 (예: `'ai_agent'`, `'text_classifier'`). 엔진이 dispatch
   * 직전 nodeId 와 함께 주입한다. AI 노드의 System Context Prefix (`node` 섹션)
   * 가 사용. 직접 unit test 하는 fixture 는 생략 허용.
   */
  nodeType?: string;
  /**
   * 엔진이 createContext 시점에 주입하는 런타임 변수. 알려진 `__`-prefix 키:
   * - `__workspaceId: string` — 현 실행의 워크스페이스 식별자
   * - `__workspaceName?: string` — `Workspace.name` 복제값. AI 노드의 System
   *   Context Prefix (spec/4-nodes/3-ai/0-common.md §11) 의 `workspace` 섹션이
   *   `(unnamed)` 폴백 대신 실제 이름을 노출할 때 사용. 빈 string 또는 부재면
   *   `(unnamed)` 폴백.
   * - `__workspaceTimezone?: string` — `Workspace.settings.timezone` (IANA)
   *   복제값. AI 노드의 System Context Prefix (spec/4-nodes/3-ai/0-common.md §11.3)
   *   가 timezone SoT 로 사용. 빈 string 또는 부재면 `process.env.TZ` / UTC fallback.
   * - `__dryRun?: boolean` — Re-run dry-run 모드 (spec/5-system/13-replay-rerun.md
   *   §7.2). `true` 면 외부 부수효과 노드(HTTP/Email/DB-write/cafe24-write)가 실제
   *   호출 대신 mock 출력(`{ _dryRun: true, skippedReason, wouldHaveCalled }`)을
   *   반환한다. Execution.dry_run 컬럼에서 createContext 시점에 주입되며 rehydration
   *   에서도 복원. 미설정/`false` 면 정상 실행.
   */
  variables: Record<string, unknown>;
  nodeOutputCache: Record<string, unknown>;
  /**
   * Per-node {@link NodeHandlerOutput} view. Populated in parallel with
   * `nodeOutputCache` by the engine after each handler call. Expression
   * resolver reads from this cache to expose `$node[X].config / .output /
   * .meta / .port / .status`.
   *
   * `ExecutionContextService.createContext` 가 항상 `{}` 로 초기화하므로
   * non-optional. 핸들러는 거의 읽지 않으며 (engine / expression resolver
   * 가 주 소비자), 직접 unit test 시 `makeExecutionContext()` 헬퍼가
   * default `{}` 를 제공한다.
   */
  structuredOutputCache: Record<string, NodeHandlerOutput>;
  /**
   * Per-node fully resolved (expression-evaluated) config snapshot. Populated
   * by the engine right after expression resolution, before handler invocation.
   *
   * Distinct from {@link rawConfig} (pre-evaluation, frozen) and from
   * `structuredOutputCache[nodeId].config` (handler's raw echo per CONVENTIONS
   * Principle 7). Container engine paths (`runContainerInner` / `runParallel`)
   * read this when computing iteration parameters — they cannot read
   * `structuredOutputCache` because handlers echo raw `{{...}}` templates.
   *
   * NOT exposed to expression context: `$node[X].config` continues to surface
   * the raw echo so downstream templates preserve original `{{...}}` strings.
   * The omission is enforced inside
   * {@link ExpressionResolverService.buildExpressionContext} — handlers must
   * never receive this field via the `$node[...]` namespace.
   *
   * Marked `Readonly` at both layers so handlers cannot mutate the cache
   * (compile-time block in TS-strict; engine writes through the dedicated
   * setter on `ExecutionContextService`).
   *
   * `createContext` 가 항상 `{}` 로 초기화하므로 non-optional.
   */
  readonly engineResolvedConfigCache: Readonly<
    Record<string, Readonly<Record<string, unknown>>>
  >;
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
   *
   * 엔진이 dispatch 직전 항상 주입한다. `?` 표기는 핸들러를 `executeNode`
   * 경유 없이 직접 unit test 하는 fixture 가 생략을 허용하기 위함 — 24개
   * 프로덕션 핸들러는 `context.rawConfig ?? config` 폴백 패턴을 사용한다.
   */
  rawConfig?: Readonly<Record<string, unknown>>;
  /**
   * `createContext` 가 항상 `0` 으로 초기화하므로 non-optional. Sub-workflow
   * inline execution 진입 시마다 1씩 증가하여 무한 재귀를 방지한다.
   */
  recursionDepth: number;
  /**
   * When set, the engine will persist every NodeExecution created under this
   * context with `parent_node_execution_id = this value`. Stamped by
   * WorkflowHandler before an inline sub-workflow run so children can be
   * grouped under their invoking Sub-Workflow row in the run-results
   * timeline. Must be restored to the prior value on inline-run return so
   * sibling nodes don't inherit it.
   */
  parentNodeExecutionId?: string;
  /**
   * Workflow 실행 동안 발생하는 사용자 인터랙션 (presentation 노드의 form
   * 제출·버튼 클릭) 과 AI 대화 turn 의 시간순 누적. AI Agent 노드가 노드
   * 설정 (`contextScope`) 으로 자동 주입받는다.
   *
   * `ExecutionContextService.createContext` 가 항상 빈 thread
   * (`createEmptyConversationThread()`) 로 초기화하므로 non-optional —
   * 핸들러는 항상 객체가 존재한다고 가정해도 안전하다.
   *
   * **Mutation 단일 진입점**: `ConversationThreadService.append*` 만 thread 를
   * 변형한다. 핸들러가 `context.conversationThread.turns.push(...)` 같은
   * 직접 mutation 을 수행하지 않는다 — opt-out 검사 / seq 부여 / totalChars
   * 갱신이 service 에 집중되어 있다.
   *
   * 상세: `spec/conventions/conversation-thread.md`.
   */
  conversationThread: ConversationThread;
  /**
   * 엔진 내부 상태 — sub-workflow inline execution 경로 (`runExecution` 의
   * `executeInline` branch) 에서만 set. `_` prefix 가 internal 신호.
   * `WorkflowHandler` 만 정당하게 읽으며 (sub-workflow bridge), 다른
   * 핸들러는 접근하지 않아야 한다.
   */
  _executedNodes?: Set<string>;
  /**
   * 엔진 내부 상태 — `ExecutionContextService` 의 in-memory
   * `Map<key, ExecutionContext>` 라우팅 키 (spec/conventions/execution-context.md
   * 원칙 4). 핸들러는 읽지 않는다. **기본값 = `executionId`** (비-background
   * context 는 항상 동일 → 동작 불변). background 서브그래프 본문만
   * `bg:<executionId>:<backgroundRunId>` 별도 키를 써서 부모와 동일한 executionId 를
   * 공유하더라도 in-memory context 가 부모 cleanup(`deleteContext(executionId)`)에
   * 의해 삭제되지 않도록 격리한다. in-memory 전용 — Redis 키 패턴과 무관.
   */
  _contextKey?: string;
  /**
   * 노드 단계 cancellation signal (parallel-p2 결정 A + H, 2026-05-30 —
   * SoT: spec/conventions/node-cancellation.md). 장기 외부 I/O 를 수행하는
   * 노드 (HTTP / DB / AI / Email / chat-channel) 는 본 signal 을 fetch /
   * cancel / timeout 등에 전파한다. signal 이 abort 된 경우 노드는 즉시
   * cleanup 후 `AbortError` 류를 throw — 엔진의 errorPolicyHandler 가
   * 그 에러를 cancelled 의미로 분류.
   *
   * **생산자** (signal 을 만들고 set 하는 caller):
   *  - `ParallelExecutor` 의 cancel-others-on-fail errorPolicy (parallel-p2 §5)
   *  - 향후 Workflow 단위 timeout / 사용자 cancel 버튼 / graceful shutdown
   *
   * **소비자** (signal 을 fetch / SDK 인자로 전파하는 handler):
   *  - HTTP — `fetch(url, { signal })`
   *  - DB — driver 의 cancel 지원 (PostgreSQL `client.cancel()` 등)
   *  - AI — Anthropic / OpenAI SDK 의 `signal` 옵션
   *  - signal 미지원 노드 (CPU 바운드 / 즉시 완료) 는 무시 가능 — best-effort
   *
   * 미설정 (= 활성 cancellation 컨텍스트 없음) 이면 노드는 평소처럼 동작.
   * 본 PR 의 범위는 type + HTTP 노드 1개의 signal 전파 — DB / AI / Email /
   * chat-channel 은 후속 PR 에서 점진 통합.
   */
  abortSignal?: AbortSignal;
}

/**
 * Parallel 컨테이너 분기 실행 컨텍스트.
 *
 * `parentParallelConcurrency` 는 중첩 Parallel 의 concurrency 곱셈 cap (spec 결정 #3/G/D)
 * 전파용으로 Parallel 분기 내부에서만 의미가 있어, 전 노드 공통 ExecutionContext 가 아니라
 * 본 컨테이너 전용 인터페이스로 분리한다.
 * SoT: spec/conventions/execution-context.md §원칙 2.
 *
 * 외부 Parallel 의 `ParallelExecutor` 가 branch context clone 시 자기
 * `effectiveConcurrency` 를 이 필드에 set 한다. 내부 Parallel 이 이를 읽어
 * 자기 `effectiveConcurrency = Math.min(internalEffective, Math.floor(32 / parent))`
 * 로 silent clamp (cap = 32, 결정 #3). 중첩 깊이 ≤ 2 가드 (planParallelBody
 * 정적 검증) 하에서만 set 되므로 한 단계만 누적.
 *
 * 상세: spec/4-nodes/1-logic/10-parallel.md §6 + § Rationale 결정 G.
 */
export interface ParallelBranchContext extends ExecutionContext {
  parentParallelConcurrency: number;
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
  /**
   * Engine-internal retry continuation state (CONVENTIONS §4.2.1, spec
   * 4-execution-engine §1.3). Populated by AI Agent multi-turn when it
   * terminates on a *retryable* error (`output.error.details.retryable ===
   * true`). Unlike `_resumeState`, this field is PRESERVED by
   * `stripControlFields()` so it persists into `NodeExecution.outputData`
   * (DB JSONB) and can later be consumed by `execution.retry_last_turn`.
   * Carries a subset of `_resumeState` plus `expiresAt` (ISO 8601 TTL).
   * Still excluded from expression resolver / autocomplete like
   * `_resumeState` (internal-only).
   */
  _retryState?: Record<string, unknown>;
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

/**
 * 모든 노드 타입이 구현하는 단일 핸들러 컨트랙트 (spec/5-system/4-execution-engine.md §5.1).
 *
 *  - **validate(config)** — 노드 정의의 정적 유효성 검사. 엔진은 `executeNode`
 *    진입 직후 호출해 INVALID_NODE_CONFIG 를 fail-fast 한다. 사용자 입력
 *    의존성 (예: `{{ ... }}` 참조) 은 expression resolution 후 별도 점검.
 *  - **execute(input, config, context)** — 실제 노드 실행. config 는 expression
 *    평가가 끝난 값 (raw 가 필요하면 `context.rawConfig` 사용). 반환값은
 *    canonical {@link NodeHandlerOutput} (config / output / meta? / port? /
 *    status?) 이어야 하며, `adaptHandlerReturn` 가 production strict mode 에서
 *    contract 위반을 throw 한다.
 *
 * Multi-turn 대화형 노드는 추가로 {@link ResumableNodeHandler} 를 구현한다.
 *
 * 신규 핸들러 작성 시 {@link CONVENTIONS} (`user_memo/node-specs-improvement/CONVENTIONS.md`)
 * Principle 1~11 을 우선 검토한다.
 */
export interface NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult;
  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<NodeHandlerOutput>;
}

/**
 * 사용자 입력 origin 신호. AI Agent `render_form` 활성 중 사용자가 일반 채팅
 * 메시지를 보내면 (form bypass), engine dispatch 가 `'ai_message'` 로 신호하여
 * handler 가 cancelled tool_result fallback 분기를 적용할 수 있게 한다
 * (spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass).
 *
 * 옵션 미전달 시 (구 호출자 / `information_extractor`) handler 는 기존 휴리스틱
 * (`state.pendingFormToolCall` set 여부 + userMessage shape) 로 분기 — 하위 호환.
 */
export type ResumableMessageSource = 'ai_message' | 'form_submitted';

/**
 * `processMultiTurnMessage` 의 세 번째 파라미터 타입. `source` 외 필드가 추가될
 * 때 인터페이스·핸들러·엔진 세 곳을 한 번에 갱신할 수 있도록 named type 으로 분리.
 *
 * 구현체가 `options` 를 사용하지 않는 경우 파라미터명을 `_options` 로 선언해
 * no-op 의도를 명시한다 (spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass
 * 는 AI Agent 한정 — 다른 구현체는 의도적으로 무시).
 */
export interface ResumableMessageOptions {
  source: ResumableMessageSource;
}

/**
 * Multi-turn 대화형 노드 (ai_agent, information_extractor) 가 구현해야 하는
 * 추가 메서드. 엔진의 `waitForAiConversation` 가 이 메서드들을 호출하므로
 * 핸들러는 두 메서드 모두를 반드시 구현해야 한다 (둘 다 optional 이 아님).
 *
 * `'processMultiTurnMessage' in handler` narrowing 가드로 일반 NodeHandler 와
 * 분기한다 (CRIT #4 — duck-typing 의존 제거).
 */
export interface ResumableNodeHandler extends NodeHandler {
  /**
   * 사용자 메시지를 받아 다음 LLM turn 을 진행. waiting 또는 종료 결과 반환.
   *
   * `options.source` 는 engine 의 `waitForAiConversation` dispatch 가 `'ai_message'`
   * vs `'form_submitted'` 를 결정적으로 알려주는 신호. AI Agent handler 의
   * form bypass 분기 (pendingFormToolCall set + `source: 'ai_message'`) 에서
   * cancelled tool_result fallback 을 적용한다.
   */
  processMultiTurnMessage(
    userMessage: string,
    state: Record<string, unknown>,
    options?: ResumableMessageOptions,
  ): Promise<unknown>;

  /**
   * 사용자가 명시적으로 대화 종료 / max_turns 도달 / error 시 호출. 종료 결과 반환.
   *
   * `errorPayload` (2026-05-19) — spec/4-nodes/3-ai/1-ai-agent.md §7.9. engine 의
   * `handleAiTurnError` 가 turn 처리 중 throw 된 예외에서 추출한 sanitized
   * 결과 (`code` / `message` / `details`) 를 전달한다. 핸들러는 그 값을
   * `output.error` 에 그대로 set 해야 spec §7.9 shape (`output.error` + 부분
   * `output.result.*` 병존) 가 성립. 정상 종결 (`user_ended` / `max_turns` /
   * `condition`) 에서는 caller 가 undefined 를 전달.
   */
  endMultiTurnConversation(
    state: Record<string, unknown>,
    endReason: 'user_ended' | 'max_turns' | 'condition' | 'error',
    errorPayload?: { code: string; message: string; details?: unknown },
    /**
     * spec/4-nodes/3-ai/1-ai-agent.md §7.9 — retryable error 종결 시, 실패한
     * turn 을 일으킨 사용자 메시지 (+ dispatch source). `state.messages` 는
     * turn 처리 전 history snapshot 이라 이 메시지를 포함하지 않으므로,
     * `_retryState` 가 별도로 운반해 retry 재진입이 같은 마지막 turn 을
     * replay 할 수 있게 한다. 정상 종결에서는 undefined.
     */
    failedUserMessage?: string,
    failedUserMessageSource?: ResumableMessageSource,
  ): unknown;
}

/** Type guard — `'processMultiTurnMessage' in handler` shorthand. */
export function isResumableNodeHandler(
  handler: NodeHandler,
): handler is ResumableNodeHandler {
  return (
    typeof (handler as Partial<ResumableNodeHandler>)
      .processMultiTurnMessage === 'function' &&
    typeof (handler as Partial<ResumableNodeHandler>)
      .endMultiTurnConversation === 'function'
  );
}
