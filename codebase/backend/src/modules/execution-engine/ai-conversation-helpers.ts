import type {
  NodeHandlerOutput,
  ResumableMessageSource,
} from '../../nodes/core/node-handler.interface';
import type { WaitingInteractionType } from './execution-engine.service';
import type {
  LlmCallRecord,
  TurnDebugEntry,
} from '../../shared/llm-tracing/llm-call-record';

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
 * AI 대화 노드 출력 봉투의 `status` 값(재개 턴 스냅샷).
 * 생산자(`buildAiResumedSnapshot`)와 판정자(`isAiResumedWaitingEnvelope`, REST 대기 정규화)가
 * 같은 값을 쓰도록 여기서만 정의한다. 프런트 `isNodeWaitingForInput` 은 패키지 경계 밖이라
 * 같은 리터럴을 따로 두고 계약 테스트로 맞춘다.
 */
export const AI_RESUMED_OUTPUT_STATUS = 'resumed';

/** AI 대화 노드 출력 봉투의 `meta.interactionType` 값. */
export const AI_CONVERSATION_INTERACTION_TYPE = 'ai_conversation';

/**
 * `outputData` 봉투가 AI 대화 재개 턴의 스냅샷인지 본다
 * (`status === 'resumed'` + `meta.interactionType === 'ai_conversation'`).
 * form · buttons 의 `resumed` 는 곧 종결되는 마지막 출력이라 `interactionType` 으로 제외한다.
 */
export function isAiResumedWaitingEnvelope(outputData: unknown): boolean {
  const envelope = outputData as {
    status?: unknown;
    meta?: { interactionType?: unknown } | null;
  } | null;
  return (
    envelope?.status === AI_RESUMED_OUTPUT_STATUS &&
    envelope.meta?.interactionType === AI_CONVERSATION_INTERACTION_TYPE
  );
}

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
    interactionType: AI_CONVERSATION_INTERACTION_TYPE,
    model: state.model,
    inputTokens,
    outputTokens,
    totalTokens: inputTokens + outputTokens,
    thinkingTokens: state.totalThinkingTokens ?? 0,
    toolCalls: state.toolCalls ?? 0,
    ragSources: state.ragSources ?? [],
    ragDiagnostics: state.ragLastDiagnostics,
    turnDebug: state.turnDebugHistory ?? [],
  };
}

// LLM 호출 trace 도메인 타입(LlmCallRecord / TurnDebugEntry)은
// shared/llm-tracing/llm-call-record 의 canonical 정의를 사용한다 (AI Agent·
// Information Extractor 와 단일 진실 공유). 위 import 참조.

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
    ? (state.turnDebugHistory as TurnDebugEntry[])
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

/** 재개 턴을 연 사용자 입력. 일반 메시지와 AI 가 띄운 폼(`render_form`) 제출 두 가지다. */
export type AiResumeInteraction =
  | { type: 'message_received'; content: string }
  | { type: 'form_submitted'; data: Record<string, unknown> };

function asPlainRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/**
 * 멀티턴 AI 재개 스냅샷(`status: 'resumed'`)을 만든다. 엔진이 재개 턴의 LLM 호출
 * 전에 한 번 싣는 관찰용 스냅샷이고 연결선 라우팅은 없다. 정본은 NERV
 * `CLE-NODE-AGENT-OUTPUT` 「멀티턴 재개」 · `CLE-NODE-EXTRACTOR` 「멀티턴 재개」다.
 *
 * - `config` 는 직전 대기 스냅샷의 설정 에코를 그대로 쓴다. 없으면 `fallbackConfig`.
 * - `output` 은 직전 대기 스냅샷을 이어 받는다(정보 추출기의 `output.partial` 포함).
 *   일반 메시지는 `output.result.messages` 끝에 사용자 메시지를 더하고, 폼 제출은
 *   다음 턴에 도구 결과로 들어가므로 `messages` 를 그대로 둔다.
 *   `output.interaction` 은 이번 입력으로 바꾼다.
 * - `meta` 는 직전 대기 스냅샷의 값을 두되 `contextInjection` 은 빼고
 *   `durationMs` 는 `0` 으로 둔다(이 시점에는 LLM 호출이 없다).
 *   `interactionType` 은 늘 `ai_conversation` 이다. 폼을 제출한 턴도 폼 입력을 더
 *   기다리지 않기 때문이다. REST 대기 정규화(`reconcilePreParkWaitingStatus`)와 프런트
 *   `isNodeWaitingForInput` 이 이 값과 `status: 'resumed'` 로 재개 턴의 행을 대기로 본다.
 * - `_resumeState` 는 이번 턴 처리에 쓰는 상태를 그대로 싣는다. DB 에 저장할 때는
 *   호출 측이 빼야 한다.
 */
export function buildAiResumedSnapshot(params: {
  previous: Record<string, unknown> | undefined;
  fallbackConfig: Record<string, unknown>;
  interaction: AiResumeInteraction;
  receivedAt: string;
  resumeState: Record<string, unknown>;
}): NodeHandlerOutput {
  const { previous, fallbackConfig, interaction, receivedAt, resumeState } =
    params;
  const output: Record<string, unknown> = {
    ...(asPlainRecord(previous?.output) ?? {}),
  };
  if (interaction.type === 'message_received') {
    const result = { ...(asPlainRecord(output.result) ?? {}) };
    const messages = Array.isArray(result.messages)
      ? (result.messages as unknown[])
      : [];
    result.messages = [
      ...messages,
      { role: 'user', content: interaction.content },
    ];
    output.result = result;
    output.interaction = {
      type: 'message_received',
      data: { content: interaction.content, role: 'user' },
      receivedAt,
    };
  } else {
    output.interaction = {
      type: 'form_submitted',
      data: interaction.data,
      receivedAt,
    };
  }

  const meta: Record<string, unknown> = {
    ...(asPlainRecord(previous?.meta) ?? {}),
  };
  delete meta.contextInjection;
  meta.durationMs = 0;
  meta.interactionType = AI_CONVERSATION_INTERACTION_TYPE;

  return {
    config: asPlainRecord(previous?.config) ?? fallbackConfig,
    output,
    meta,
    status: AI_RESUMED_OUTPUT_STATUS,
    _resumeState: resumeState,
  };
}

/** AI 대화 노드가 다음 입력을 기다릴 때 출력 봉투의 `status` 값. */
const AI_WAITING_OUTPUT_STATUS = 'waiting_for_input';

/** {@link readCrashedAiTurn} 결과. */
export interface CrashedAiTurn {
  /** 처리 중이던 턴의 입력. 재생 턴에 그대로 넘긴다. */
  interaction: AiResumeInteraction;
  /**
   * 그 턴을 받기 직전의 대기 봉투. 재생 턴이 이 봉투를 직전 대기 스냅샷으로 삼아
   * 재개 스냅샷을 다시 만든다. `_resumeCheckpoint` 는 스냅샷의 값을 그대로 둔다.
   */
  waitingEnvelope: Record<string, unknown>;
}

/**
 * 크래시 재구동(§7.5 case B)이 처리 중이던 AI 턴을 다시 돌릴 재료를 옛 행 출력에서 읽는다.
 * 정본은 NERV `CLE-EXEC-STATE-RESUME` 「크래시 재구동에서 처리 중이던 턴을 다시 돌린다」다.
 *
 * 옛 행 출력은 {@link buildAiResumedSnapshot} 이 LLM 호출 전에 저장한 재개 스냅샷이다.
 * 거기서 입력(`output.interaction`)을 꺼내고 대기 봉투를 되살린다.
 * - 일반 메시지 턴이면 스냅샷이 `output.result.messages` 끝에 더한 사용자 메시지를 뺀다.
 *   끝 메시지가 입력과 다르면 건드리지 않는다.
 * - `output.interaction` 을 지우고 `status` 를 대기로 되돌린다.
 * - 스냅샷이 지운 `meta.contextInjection` 과 원래 `meta.durationMs` 는 되살리지 못한다.
 *   재생 턴이 곧 새 스냅샷으로 덮는 관찰용 값이다.
 *
 * 재개 스냅샷이 아니거나 입력을 읽을 수 없으면 `null` 이다. 호출 측은 그 노드를 처음부터
 * 다시 실행한다.
 */
export function readCrashedAiTurn(outputData: unknown): CrashedAiTurn | null {
  if (!isAiResumedWaitingEnvelope(outputData)) return null;
  const snapshot = outputData as Record<string, unknown>;
  const output = { ...(asPlainRecord(snapshot.output) ?? {}) };
  const raw = asPlainRecord(output.interaction);
  const data = asPlainRecord(raw?.data);
  let interaction: AiResumeInteraction;
  if (raw?.type === 'message_received' && typeof data?.content === 'string') {
    interaction = { type: 'message_received', content: data.content };
    const result = asPlainRecord(output.result);
    const messages = Array.isArray(result?.messages)
      ? (result.messages as unknown[])
      : undefined;
    const last = asPlainRecord(messages?.[messages.length - 1]);
    if (
      messages &&
      last?.role === 'user' &&
      last.content === interaction.content
    ) {
      output.result = { ...result, messages: messages.slice(0, -1) };
    }
  } else if (raw?.type === 'form_submitted' && data) {
    interaction = { type: 'form_submitted', data };
  } else {
    return null;
  }
  delete output.interaction;
  const { _resumeState: _dropped, ...rest } = snapshot;
  void _dropped;
  return {
    interaction,
    waitingEnvelope: { ...rest, output, status: AI_WAITING_OUTPUT_STATUS },
  };
}
