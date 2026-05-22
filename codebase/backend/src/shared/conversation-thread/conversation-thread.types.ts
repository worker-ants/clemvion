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
