import type { ResumableMessageSource } from '../../nodes/core/node-handler.interface';
import type { WaitingInteractionType } from './execution-engine.service';

/**
 * C-1 step3 (W3) — AI 멀티턴 대화 lifecycle 이 공유하는 순수 helper / sentinel.
 *
 * `ExecutionEngineService`(엔진) 와 추출된 `AiTurnOrchestrator` 가 모두 사용하던
 * 값 심볼(class/function)을 본 leaf 모듈로 분리해 두 서비스 파일 사이의 ES module
 * 런타임 순환 import 를 제거한다. 엔진은 `forwardRef` DI 를 위해 orchestrator 를
 * 값(value)으로 import 하므로, 반대로 orchestrator → 엔진 값 import 가 남으면
 * 런타임 순환이 된다. 본 파일로 helper 를 옮겨 orchestrator 가 엔진을 값으로
 * import 하지 않게 한다.
 *
 * `WaitingInteractionType` 정의 자체는 interaction-type-registry.md §1.1 핀에 따라
 * 엔진 파일에 잔류하므로, 여기서는 **타입 전용 import** 로만 참조한다(런타임에
 * 소거되어 순환을 만들지 않는다). 엔진은 외부 import 호환을 위해 본 파일의
 * 심볼을 re-export 한다.
 */

/**
 * Phase 2.3a — §7.5 rehydration 경로 전용 에러. RehydrateAndResume 의 정상
 * 종결 분기는 RESUME_CHECKPOINT_MISSING / RESUME_INCOMPATIBLE_STATE / RESUME_FAILED
 * 세 코드 중 하나로 마무리되며, 본 클래스로 표현해 outer try/catch 가 분기.
 *
 * - `RESUME_CHECKPOINT_MISSING` — `NodeExecution.outputData` / Workflow 정의 등
 *   재구성에 필요한 데이터가 부재하거나 상태 invariant 가 깨진 경우.
 * - `RESUME_INCOMPATIBLE_STATE` — multi-turn AI 의 `_resumeState` deserialize
 *   불가 등 in-memory 전용 상태가 영속 보존되지 않은 케이스 (WARN #6).
 * - `RESUME_FAILED` — 위 두 분류에 속하지 않는 일반 런타임 실패. BullMQ attempts
 *   소진까지 보낸 뒤에도 본 코드로 dead-letter 마킹.
 */
// C-1 step2 — 추출된 AiTurnOrchestrator.handleAiResumeTurn 도 동일 에러 타입을
// throw 하므로 export (정의는 본 helper 모듈에 잔류).
export class RehydrationError extends Error {
  constructor(
    public readonly code:
      | 'RESUME_CHECKPOINT_MISSING'
      | 'RESUME_FAILED'
      | 'RESUME_INCOMPATIBLE_STATE',
    message: string,
  ) {
    super(message);
    this.name = 'RehydrationError';
  }
}

/**
 * NodeExecution.outputData (envelope `{config, output, meta?, port?, status?}`)
 * 의 `meta.interactionType` 을 명시 보장. 페이지 재마운트 시
 * `execution.snapshot` reconcile (frontend) 이 이 필드로 store 의
 * `waitingInteractionType` 을 set 해 form/buttons/ai_conversation 분기를
 * 정확히 hydrate 한다. 누락 시 카테고리 선택 (Carousel) 의 Preview 탭
 * 버튼이 callback 없이 disabled 로 그려지는 회귀가 발생.
 */
// C-1 step2 — AiTurnOrchestrator(추출 서비스)도 동일 helper 를 사용하므로 export.
export function withInteractionMeta(
  output: Record<string, unknown>,
  interactionType: WaitingInteractionType,
): Record<string, unknown> {
  const next = { ...output };
  const prevMeta = (next.meta as Record<string, unknown> | undefined) ?? {};
  next.meta = { ...prevMeta, interactionType };
  return next;
}

/**
 * Conversation 노드가 진행 중일 때 frontend run-results UI 의 References /
 * LLM Usage / Meta 탭이 동작하도록 _resumeState 의 누적 통계와 turn 단위 RAG
 * delta 를 `meta.*` 로 펼쳐 노출한다. _resumeState 자체는 system prompt /
 * llmConfigId 등 internal 필드를 포함하므로 client 에 그대로 보내지 않는다.
 *
 * 첫 waiting (사용자 첫 메시지 전) 에서는 turnCount=0 이고 turnDebugHistory
 * 도 없으므로 turnDebug=[] / ragSources=[] 로 채워져 References 탭은 자동
 * 숨김 (`hasReferences=false`).
 *
 * @internal — 테스트 보조용으로 공개. 외부 모듈에서 직접 import 하지 않는다.
 */
export function buildConversationMetaFromResumeState(
  state: Record<string, unknown>,
): Record<string, unknown> {
  const inputTokens = (state.totalInputTokens as number) ?? 0;
  const outputTokens = (state.totalOutputTokens as number) ?? 0;
  return {
    interactionType: 'ai_conversation',
    model: state.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    thinkingTokens: (state.totalThinkingTokens as number) ?? 0,
    toolCalls: (state.toolCalls as number) ?? 0,
    ragSources: (state.ragSources as unknown[]) ?? [],
    ragDiagnostics: state.ragLastDiagnostics,
    turnDebug: (state.turnDebugHistory as unknown[]) ?? [],
  };
}

/**
 * Single LLM call trace (request / response / latency) — one entry per call
 * inside a turn. A turn produces multiple entries when tool loops occur.
 * Mirrors `LlmCallTrace` defined in the AI handlers.
 */
interface LlmCallRecord {
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
  /** ISO8601 — LLM 호출 시작/종료 절대 시각. 디버깅 타임라인의 어시스턴트
   *  발생 시각 표시 출처. spec/5-system/6-websocket-protocol.md §4.4 */
  startedAt?: string;
  finishedAt?: string;
}

/** One entry of `state.turnDebugHistory`. `totalDurationMs` is the wall-clock
 * sum across all LLM calls + tool calls in the turn; `durationMs` on each
 * `llmCalls[]` item is the per-call latency. */
interface AiTurnDebugEntry {
  turnIndex: number;
  llmCalls?: LlmCallRecord[];
  totalDurationMs?: number;
}

/**
 * Extract per-turn LLM debug payload from the last entry of
 * `state.turnDebugHistory`, for the `execution.ai_message` WebSocket event.
 * Both the waiting_for_input emit and the terminal emit use this so the two
 * branches stay in lockstep — the frontend's debug timeline (Response /
 * Request / LLM Usage tabs) can match assistant messages to their LLM calls
 * regardless of whether the conversation is still in flight.
 *
 * Field mapping:
 *  - `lastTurn.llmCalls` → `llmCalls` (shallow-copied so later turns mutating
 *    the resumeState array can't retroactively change a buffered emit)
 *  - `lastTurn.totalDurationMs` → top-level `durationMs` (turn total)
 *
 * Returns an object with optional fields so callers can spread it into
 * the event payload without emitting `llmCalls: undefined` keys when no
 * turns have run yet.
 *
 * @internal — 테스트 보조용으로 공개. 외부 모듈에서 직접 import 하지 않는다.
 */
export function buildAiMessageDebugFromResumeState(
  state: Record<string, unknown>,
): { llmCalls?: LlmCallRecord[]; durationMs?: number } {
  const turnDebugArray = Array.isArray(state.turnDebugHistory)
    ? (state.turnDebugHistory as AiTurnDebugEntry[])
    : [];
  const lastTurnDebug =
    turnDebugArray.length > 0
      ? turnDebugArray[turnDebugArray.length - 1]
      : undefined;
  const result: { llmCalls?: LlmCallRecord[]; durationMs?: number } = {};
  // Array.isArray rejects null / undefined / non-array values so `llmCalls:
  // null` in resumeState (defensive against legacy state shapes) doesn't
  // leak into the payload as a non-array value.
  if (Array.isArray(lastTurnDebug?.llmCalls)) {
    result.llmCalls = [...lastTurnDebug.llmCalls];
  }
  if (typeof lastTurnDebug?.totalDurationMs === 'number') {
    result.durationMs = lastTurnDebug.totalDurationMs;
  }
  return result;
}

/**
 * Backfill `source: 'live'` on any non-system message that lacks the marker.
 * The handler's `messages.push` sites leave `source` undefined so the
 * 'live' default applies here in one place; injection results from
 * `mapTurnsToChatMessages` already set `'injected'` and are preserved.
 * System messages are skipped — they're filtered out before reaching the
 * emit payload anyway, but the explicit guard makes the function safe to
 * call regardless of filter ordering.
 * Spec: spec/5-system/6-websocket-protocol.md §4.4.6.
 */
// C-1 step2 — AiTurnOrchestrator(추출 서비스)도 동일 helper 를 사용하므로 export.
export function withSourceMarker(
  messages: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  return messages.map((m) => {
    if (m.role === 'system') return m;
    return m.source === 'injected' || m.source === 'live'
      ? m
      : { ...m, source: 'live' as const };
  });
}

/**
 * Build the WS-event `conversationConfig` block from a NodeHandlerOutput's
 * `output`. System messages are filtered out for client display, and each
 * remaining message is guaranteed to carry a `source: 'live' | 'injected'`
 * marker per spec/5-system/6-websocket-protocol.md §4.4.6.
 *
 * D6 (2026-05-17) — multi-turn 의 `message` / `messages` / `turnCount` 는
 * waiting/resumed/ended 모두 `output.result.*` 단일 경로로 통일됐다. 이 함수는
 * waiting / 첫 진입 시점에서 호출되며 핸들러가 push 한 `output.result.*` 를
 * 읽는다 (spec/4-nodes/3-ai/1-ai-agent.md §7.4/§7.5). `output.partial.*`
 * (info-extractor 의 부분 수집 진행 상태) 은 의미 분리 유지로 top-level 그대로.
 *
 * `maxTurns` (2026-05-31, decision C-1) — static config 값이라 `output.result`
 * 에 echo 하지 않는다 (CONVENTIONS Principle 1.1). WS UI 의 진행률 분모
 * ("Turn N/M") 용으로는 **config echo (`output.config.maxTurns`)** 에서 읽어
 * `conversationConfig.maxTurns` 로 전달한다 — caller 가 두 번째 인자로 config
 * echo 를 넘긴다.
 */
export function buildConversationConfigFromOutput(
  output: Record<string, unknown> | undefined,
  config?: Record<string, unknown>,
): {
  message: string;
  turnCount: number;
  maxTurns?: number;
  messages: Array<Record<string, unknown>>;
  presentations?: Array<Record<string, unknown>>;
  extracted?: Record<string, unknown>;
  missingFields?: string[];
  collectionRetryCount?: number;
} {
  const o = output ?? {};
  const r = (o.result as Record<string, unknown> | undefined) ?? {};
  const partial = (o.partial as Record<string, unknown> | undefined) ?? {};
  const messagesAll =
    (r.messages as Array<Record<string, unknown>> | undefined) ?? [];
  const result: {
    message: string;
    turnCount: number;
    maxTurns?: number;
    messages: Array<Record<string, unknown>>;
    presentations?: Array<Record<string, unknown>>;
    extracted?: Record<string, unknown>;
    missingFields?: string[];
    collectionRetryCount?: number;
  } = {
    message: (r.message as string | undefined) ?? '',
    turnCount: (r.turnCount as number | undefined) ?? 0,
    messages: withSourceMarker(messagesAll.filter((m) => m.role !== 'system')),
  };
  // decision C-1 — maxTurns 는 output.result 에 없다. config echo 에서 읽어
  // WS UI 진행률 분모로만 전달 (Principle 1.1).
  const maxTurns = config?.maxTurns as number | undefined;
  if (maxTurns !== undefined) result.maxTurns = maxTurns;
  // spec §4.1·§7.10 — presentations emitted by render_* tools in this turn.
  const presentationsRaw = r.presentations;
  if (Array.isArray(presentationsRaw) && presentationsRaw.length > 0) {
    result.presentations = presentationsRaw as Array<Record<string, unknown>>;
  }
  if (partial.extracted !== undefined)
    result.extracted = partial.extracted as Record<string, unknown>;
  if (partial.missingFields !== undefined)
    result.missingFields = partial.missingFields as string[];
  if (partial.collectionRetryCount !== undefined)
    result.collectionRetryCount = partial.collectionRetryCount as number;
  return result;
}

/**
 * USER_MESSAGE 라이브 신호 발화 여부 게이팅 (spec/4-nodes/3-ai/1-ai-agent.md §7.5).
 * 일반 채팅(`'ai_message'`) 과 form bypass(텍스트 메시지, 동일 source — §6.2 step
 * 2.c.bypass) 에서는 발화하고, form 제출(`'form_submitted'` → `presentation_user`)
 * 에서는 발화하지 않는다. `ResumableMessageSource` union 에 source 가 추가되면
 * 본 predicate 의 분기를 명시적으로 갱신해야 한다.
 */
export function userMessageSignalApplies(
  source: ResumableMessageSource,
): boolean {
  return source !== 'form_submitted';
}
