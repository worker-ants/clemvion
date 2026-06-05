/**
 * Conversation Thread — workflow-execution 동안 발생하는 사용자 인터랙션과
 * AI 대화 turn 의 시간순 누적. AI Agent 노드가 노드 설정 (`contextScope`) 으로
 * 자동 주입받는다.
 *
 * SoT: spec/conventions/conversation-thread.md
 */

/**
 * v1 thread ID. 단일 thread 만 지원하므로 고정값.
 *
 * NOTE: 값 문자열 `'default'` 는 노드 출력 포트 예약어 `'default'`
 * (CONVENTIONS Principle 6) 와 동일하지만 namespace 가 완전히 분리되어 있어
 * 런타임 충돌 없음. 코드에서는 항상 본 상수를 통해 참조하고 magic string
 * 직접 사용을 금한다.
 */
export const DEFAULT_THREAD_ID = 'default' as const;

export type ConversationTurnSource =
  | 'presentation_user'
  | 'ai_user'
  | 'ai_assistant'
  | 'ai_tool'
  | 'system';

/**
 * Presentation payload emitted by an AI Agent `render_*` tool call.
 * SoT: spec/4-nodes/3-ai/1-ai-agent.md §7.10 (type definition single source).
 *
 * Top-level `presentations[]` on a `ConversationTurn` is intentionally distinct
 * from `data?` (which is the `output.interaction.data` snapshot per
 * node-output §4.5). `data?` carries form/button interaction payloads, while
 * `presentations` carries LLM-emitted render outputs — separate semantics,
 * separate fields to prevent drift.
 *
 * **단일 진실 (backend)**: `PRESENTATION_TYPES` 상수는 본 모듈이 export 하고
 * `ai-agent.schema.ts` 의 zod enum 등 backend 의 모든 사용처가 이 상수를
 * 재참조한다. drift 방지 — 신규 type 추가 시 본 줄만 수정하면 backend 전체에
 * 자동 전파된다.
 */
export const PRESENTATION_TYPES = [
  'table',
  'chart',
  'carousel',
  'template',
  'form',
] as const;
export type PresentationType = (typeof PRESENTATION_TYPES)[number];

export interface PresentationPayloadTruncation {
  itemsTruncated?: boolean;
  rowsTruncated?: boolean;
  itemsTotalCount?: number;
  rowsTotalCount?: number;
}

export interface PresentationPayload {
  /** Presentation node category — selects the renderer on the frontend. */
  type: PresentationType;
  /** Provider tool_use id — join key with `meta.presentationCalls[*].toolCallId`. */
  toolCallId: string;
  /** Server-side render timestamp (ISO 8601 UTC). */
  renderedAt: string;
  /**
   * Final payload after `defaults` overlay — same shape as the presentation
   * node's input schema. Frontend renders this via the shared
   * `presentation-renderers.tsx` components.
   */
  payload: Record<string, unknown>;
  /**
   * Set only when Carousel/Table tail truncation applied (1MB cap, see
   * presentation common §4 / §10.4).
   */
  truncation?: PresentationPayloadTruncation;
}

/**
 * Provider tool invocation captured on an `ai_assistant` turn (when the LLM
 * emits one or more tool_use entries). Mirrored 1:1 from the LLM provider's
 * `toolCalls` so downstream cross-provider injection can drop unsupported
 * fields without losing type safety.
 */
export interface ConversationTurnToolCall {
  /** Provider-issued tool_use id — pairs with a later `ai_tool` turn's `toolCallId`. */
  id: string;
  /** Tool name as advertised to the LLM (`kb_*`, `mcp_*`, `cond_*` etc). */
  name: string;
  /** Raw JSON-string argument payload — the LLM's parsed call without re-serialization. */
  arguments: string;
}

export interface ConversationTurn {
  /** thread 내 단조 증가 sequence — append 순서 == 시간 순서. */
  seq: number;
  /** turn 을 발생시킨 그래프 노드의 UUID. */
  nodeId: string;
  /**
   * append 시점의 노드 라벨 snapshot. 라벨이 추후 변경되어도 thread 의 표시
   * 일관성이 유지된다.
   */
  nodeLabel: string;
  /** 노드 타입 (예: 'form', 'carousel', 'ai_agent'). */
  nodeType: string;
  /** 서버 시각 (ISO 8601). */
  timestamp: string;
  source: ConversationTurnSource;
  /**
   * system_text injection 모드의 1차 텍스트 + UI 표시. 빈 문자열 가능
   * (구조화 데이터만 있는 경우 — text 변환 규칙은 spec §1.4).
   */
  text: string;
  /**
   * 구조화 원본 — `output.interaction.data` snapshot 또는 핸들러가 보존한
   * payload. `messages` 모드에서는 사용되지 않고 디버깅·UI 용.
   */
  data?: Record<string, unknown>;
  /**
   * `source: 'ai_assistant'` 한정. provider 호환성을 위해 messages 모드에서
   * drop 가능 (spec §5.1).
   */
  toolCalls?: ConversationTurnToolCall[];
  /** `source: 'ai_tool'` 한정 — 짝이 되는 toolCall id. */
  toolCallId?: string;
  /**
   * `source: 'ai_assistant'` 한정 — AI Agent 가 `render_*` tool family
   * (spec/4-nodes/3-ai/1-ai-agent.md §4.1) 로 emit 한 표·차트·캐러셀·템플릿·폼
   * 페이로드. **top-level 독립 필드 — `data?` 와 별개** (`data?` 는
   * `output.interaction.data` 스냅샷 단일 진실이라 다른 의미의 데이터를
   * 박지 않는다). 한 turn 에 텍스트 응답 (`text`) 과 함께 공존 가능.
   * type 정의의 단일 진실은 spec §7.10.
   */
  presentations?: PresentationPayload[];
}

export interface ConversationThread {
  /** v1 고정값 `DEFAULT_THREAD_ID`. multi-thread 는 v2 로드맵. */
  id: string;
  /** 다음 append 에 부여될 seq (== `turns.length`). */
  nextSeq: number;
  /**
   * 누적된 turn 들. 외부 컨슈머는 ReadonlyArray 로만 다룬다 — 직접
   * `.push()` / `.splice()` 등으로 변형해서는 안 된다 (불변량 보장:
   * spec/conventions/conversation-thread.md §3.2 background isolation
   * 과 §5 inject 가 둘 다 turn 객체의 immutability 에 의존). 모든
   * mutation 은 `ConversationThreadService.append*` 단일 진입점을 통해
   * 일어난다 — service 는 internally cast 로 push.
   */
  turns: ReadonlyArray<ConversationTurn>;
  /**
   * 누적 char 길이 캐시 — append 시점에 `text.length` 를 누적해 갱신한다.
   * WebSocket payload / `meta.contextInjection.totalInjectedChars` 등 외부
   * 소비처가 thread 크기를 O(1) 로 확인할 때 사용한다. `applyCap` 자체는
   * `ConversationTurn[]` 만 받아 `sumChars` 로 다시 계산하므로 본 캐시는
   * 사용하지 않는다 (각자 다른 컨텍스트 — append 누적 vs 주입 시점 cap).
   */
  totalChars: number;
  /**
   * 롤링 요약 본문. AI Agent 의 `memoryStrategy ∈ {summary_buffer, persistent}`
   * 전략에서만 set (spec/conventions/conversation-thread.md §1.3,
   * spec/4-nodes/3-ai/1-ai-agent.md §6.1). `manual` 전략에서는 미설정.
   * thread 의 일부이므로 park 시 `Execution.conversation_thread` durable 스냅샷에
   * 함께 commit 되어 rehydration(§7.5)으로 복원된다 (§4 영속화·§8.4). park 사이
   * active 진행 중 ExecutionContext 유실 시 fallback 은 [1-ai-agent §12.13].
   */
  runningSummary?: string;
  /**
   * `runningSummary` 가 압축해 커버하는 마지막 turn 의 `seq`. 이 seq 이하 turn 은
   * 요약 블록으로 대체되고 이후 turn 만 원문으로 유지된다 (휘발성 꼬리).
   * `summary_buffer` / `persistent` 전략에서만 set.
   */
  summarizedUpToSeq?: number;
}

/**
 * Internal mutable view used by `ConversationThreadService` only — keeps
 * `turns` writable so the service can `push()` / `splice()` while every
 * external caller still sees the readonly form.
 */
export interface MutableConversationThread extends Omit<
  ConversationThread,
  'turns'
> {
  turns: ConversationTurn[];
}

/**
 * 빈 thread 팩토리 — `ExecutionContextService.createContext` 가 사용.
 *
 * Returns the mutable internal view; assigning the result to a
 * `ConversationThread` reference (the public type) silently widens to
 * the readonly turns array — desired for callers, but service paths can
 * keep the mutable handle when they construct one themselves.
 */
export function createEmptyConversationThread(): MutableConversationThread {
  return {
    id: DEFAULT_THREAD_ID,
    nextSeq: 0,
    turns: [],
    totalChars: 0,
  };
}

/**
 * durable park 스냅샷(`Execution.conversation_thread` jsonb, spec
 * conversation-thread.md §4·§8.4)에서 로드한 raw 값을 안전한
 * `MutableConversationThread` 로 정규화한다 — §7.5 rehydration 진입점.
 *
 * jsonb 는 plain object 로 역직렬화되므로 `turns` 는 일반 배열이다. 본 함수는
 * (a) 누락/손상 필드를 기본값으로 보강하고 (schema drift graceful), (b) `turns`
 * 를 새 배열로 복사해 영속본 참조와 분리하며, (c) `nextSeq`/`totalChars` 가
 * 비정상이면 `turns` 로부터 재유도해 append 불변량(`nextSeq == turns.length`)을
 * 보존한다. raw 가 null/비객체면 빈 thread 를 반환한다 (회귀 없음).
 */
export function rehydrateConversationThread(
  raw: unknown,
): MutableConversationThread {
  if (!raw || typeof raw !== 'object') {
    return createEmptyConversationThread();
  }
  const r = raw as Record<string, unknown>;
  // turns 가 배열이 아니면 스냅샷 자체가 손상된 것 — 빈 thread 로 전체 리셋한다
  // (회귀 없음). 정상 jsonb round-trip 에서는 발생하지 않는다.
  if (!Array.isArray(r.turns)) {
    return createEmptyConversationThread();
  }
  const turns: ConversationTurn[] = [...(r.turns as ConversationTurn[])];
  const id = typeof r.id === 'string' ? r.id : DEFAULT_THREAD_ID;
  // nextSeq 는 monotonic append 카운터다 — eviction(§STORAGE_MAX_TURNS) 으로
  // 오래된 turn 이 drop 돼도 감소하지 않으므로 `turns.length` 보다 클 수 있다.
  // 저장값이 number 이고 turns.length 이상이면 그대로 보존(seq 재사용 방지),
  // 비숫자거나 turns.length 미만(손상)이면 turns.length 로 재유도한다.
  const storedNextSeq = r.nextSeq;
  const nextSeq =
    typeof storedNextSeq === 'number' && storedNextSeq >= turns.length
      ? storedNextSeq
      : turns.length;
  // totalChars 는 현재 turns 의 text.length 합과 일치한다 (service 가 eviction
  // 시 제거분을 차감해 유지). rehydration 은 hot path 가 아니므로 turns 에서
  // 재계산해 캐시 drift 를 제거한다 (정상 스냅샷에서는 저장값과 동일).
  const totalChars = turns.reduce(
    (sum, t) => sum + (typeof t?.text === 'string' ? t.text.length : 0),
    0,
  );
  const thread: MutableConversationThread = { id, nextSeq, turns, totalChars };
  if (typeof r.runningSummary === 'string') {
    thread.runningSummary = r.runningSummary;
  }
  if (typeof r.summarizedUpToSeq === 'number') {
    thread.summarizedUpToSeq = r.summarizedUpToSeq;
  }
  return thread;
}
