// 위젯 상태기계 reducer. SoT: spec/7-channel-web-chat/1-widget-app §3·§3.1.
// phase: collapsed → (open) panel(transient) → booting(eager 시작) → streaming ↔ awaiting_user_message → ended.
// 워크플로우는 패널 open 시 시작한다(eager, §R6) — 첫 사용자 입력을 기다리지 않으며 firstMessage 미사용.

import type { DisplayMessage } from "./conversation";
import type { ExternalInteractionType } from "./eia-types";

export type WidgetPhase =
  | "collapsed"
  | "panel"
  | "booting"
  | "streaming"
  | "awaiting_user_message"
  | "ended"
  // 임베드 allowlist soft 검증 실패 — 렌더/시작 거부(4-security §3-①).
  | "blocked";

export interface PendingInteraction {
  type: ExternalInteractionType;
  config?: Record<string, unknown>;
  nodeId?: string;
}

/**
 * 자유 텍스트 입력 표면인지 판정 — `buttons`/`form` 은 선택/제출 표면이라 텍스트 입력 비대상(§R6).
 * `null`(ai_conversation 진입 전 등)도 텍스트 표면으로 본다(현행 동작 보존). allowlist 의미:
 * "텍스트 표면 = buttons/form 이 아님". use-widget(전송/큐 flush 게이팅)과 panel(Composer 활성)이
 * 같은 판정을 공유하도록 단일화한다(텍스트표면 판정 3중 중복 제거).
 */
export function isTextInputSurface(pending: PendingInteraction | null): boolean {
  return pending?.type !== "buttons" && pending?.type !== "form";
}

/**
 * 대화가 **확립된** phase 판정 — 헤더 세션 컨트롤(새 대화/대화 종료) 노출 조건(§3.1).
 * `streaming`/`awaiting_user_message` 에서만 true. `booting`(webhook POST in-flight, 세션 미persist)은
 * **제외** — 이 구간에 컨트롤을 노출하면 (a) 대화 종료가 서버 취소 명령을 못 보낸다(sessionRef null).
 * ((b) 새 대화 재클릭이 in-flight `start()` 와 겹쳐 중복 webhook 을 쏘는 문제는 이제 UI 게이팅과 무관하게
 * `newChat` single-flight coalesce 가 원천 차단한다(§R9-A, `use-widget.ts` — booting 중 흡수). booting 제외는
 * host `resetSession` 도 UI 게이트 밖이라 UI 게이팅만으론 불충분한 걸 coalesce 로 완결한 것.) 세션이 확립된
 * 뒤(streaming = webhook 202 수신·persist 완료)에만 노출해 (a)를 차단한다(직전 start 정착 보장).
 * 대화 시작 전(`collapsed`/`panel`)·종료(`ended`)·차단(`blocked`)에서도 미노출. phase 파생 로직은 본 모듈에
 * 단일화(`isTextInputSurface` 선례) — 프레젠테이션 컴포넌트가 결과만 소비한다.
 */
export function isActiveConversationPhase(phase: WidgetPhase): boolean {
  return phase === "streaming" || phase === "awaiting_user_message";
}

export interface WidgetState {
  phase: WidgetPhase;
  /** 패널 가시성. close 해도 대화(phase)는 유지(§3.1). */
  open: boolean;
  /**
   * 위젯(런처) 가시성 — host `hide`/`show` 로 토글하는 **open/close 와 직교한 축**(§3.2).
   * `hidden` 이면 런처+패널 모두 미렌더(대화·SSE 는 유지). `blocked`(정책 거부)와 달리 host 가 복구 가능.
   */
  hidden: boolean;
  messages: DisplayMessage[];
  pending: PendingInteraction | null;
  unread: number;
  executionId?: string;
  error?: string;
}

export const initialState: WidgetState = {
  phase: "collapsed",
  open: false,
  hidden: false,
  messages: [],
  pending: null,
  unread: 0,
};

export type WidgetAction =
  | { type: "OPEN" }
  | { type: "CLOSE" }
  /** I11: eager 시작(§R6) — open 시 발행. userText 없음. phase → booting. */
  | { type: "START" }
  | { type: "RESTORED"; executionId: string }
  | { type: "BOOTED"; executionId: string }
  | { type: "WAITING"; interaction: PendingInteraction; threadMessages?: DisplayMessage[] }
  | { type: "AI_MESSAGE"; text: string; presentations?: Array<Record<string, unknown>> }
  | { type: "USER_MESSAGE"; text: string }
  | { type: "ENDED"; reason?: string }
  | { type: "ERROR"; message: string }
  | { type: "BLOCKED"; reason?: "origin_not_allowed" | string }
  | { type: "SHOW" }
  | { type: "HIDE" }
  | { type: "NEW_CHAT" };

function assistantMsg(
  text: string,
  presentations?: Array<Record<string, unknown>>,
): DisplayMessage {
  return {
    role: "assistant",
    text,
    source: "live",
    presentations: presentations?.length ? presentations : undefined,
  };
}
function userMsg(text: string): DisplayMessage {
  return { role: "user", text, source: "live" };
}

export function widgetReducer(state: WidgetState, action: WidgetAction): WidgetState {
  switch (action.type) {
    case "OPEN":
      return {
        ...state,
        open: true,
        unread: 0,
        phase: state.phase === "collapsed" ? "panel" : state.phase,
      };
    case "CLOSE":
      return { ...state, open: false, phase: state.phase === "panel" ? "collapsed" : state.phase };
    case "START":
      // eager 시작(패널 open 시) — 사용자 입력/메시지 없이 execution 만 시작(§R6).
      return {
        ...state,
        phase: "booting",
        open: true,
        pending: null,
      };
    case "RESTORED":
      return { ...state, executionId: action.executionId, phase: "streaming" };
    case "BOOTED":
      return { ...state, executionId: action.executionId, phase: "streaming" };
    case "WAITING":
      // **종료된 대화는 입력 표면을 다시 열지 않는다** — 최후 방어선.
      //
      // 이 무조건 전이가 "종료된 위젯이 stale seed 응답으로 부활" 버그의 **직접 원인**이었다.
      // 근본 원인(호출부의 staleness 가드 누락)은 `worldGenRef` 로 고쳤지만, 그 가드는 호출부
      // 4곳이 각자 지켜야 하는 규율이라 새 호출부가 추가되면 다시 뚫릴 수 있다. 리듀서는 모든
      // 경로가 반드시 통과하는 단일 지점이므로 여기서 한 번 더 막는다(defense-in-depth).
      //
      // 대화 재개는 `ended` 를 먼저 벗어난 **뒤** WAITING 을 받는다 — `START`(→`booting`) 또는
      // `NEW_CHAT`(→`panel`). 따라서 `ended` 인 채로 도착한 WAITING 은 정의상 옛 세계의 것이다.
      //
      // **가드 범위는 WAITING 뿐이다** — `RESTORED`/`BOOTED`/`USER_MESSAGE` 도 `state.phase` 를
      // 검사하지 않고 무조건 전이하므로, "ended 를 벗어나는 액션"의 리듀서 레벨 불변식은 아직 없다.
      // 현재는 호출부가 `ended` 에서 그 액션들을 디스패치하지 않아 활성 버그가 아니고, 이번 라운드는
      // 재현된 버그 표면(WAITING)만 최소로 막는다. 확대는 후속 — C1 이 보여줬듯 "명백히 안전해
      // 보이는" 가드가 영구 정지를 만들 수 있어, 실패 사례 없이 넓히지 않는다.
      // (ai-review 2026-07-17 08_29_33 W4 / 09_36_01 documentation·maintainability)
      if (state.phase === "ended") return state;
      return {
        ...state,
        phase: "awaiting_user_message",
        pending: action.interaction,
        messages: action.threadMessages
          ? mergeMessages(state.messages, action.threadMessages)
          : state.messages,
      };
    case "AI_MESSAGE":
      return {
        ...state,
        messages: [...state.messages, assistantMsg(action.text, action.presentations)],
        // 패널 닫힌 채 도착한 in-flight 메시지 → unread(N4).
        unread: state.open ? state.unread : state.unread + 1,
      };
    case "USER_MESSAGE":
      return {
        ...state,
        phase: "streaming",
        pending: null,
        messages: [...state.messages, userMsg(action.text)],
      };
    case "ENDED":
      return { ...state, phase: "ended", pending: null };
    case "ERROR":
      return { ...state, phase: "ended", pending: null, error: action.message };
    case "BLOCKED":
      // 임베드 허용 안 된 호스트 — 위젯을 띄우지 않는다(렌더 거부 + 시작 차단).
      return {
        ...state,
        phase: "blocked",
        open: false,
        pending: null,
        error: action.reason,
      };
    case "HIDE":
      // 위젯(런처) 자체를 페이지에서 숨김 — 대화 phase·open 은 그대로 유지(§3.2).
      return { ...state, hidden: true };
    case "SHOW":
      return { ...state, hidden: false };
    case "NEW_CHAT":
      return {
        ...initialState,
        open: true,
        phase: "panel",
      };
    default:
      return state;
  }
}

/**
 * durable thread snapshot 과 로컬 라이브 메시지 중 **하나를 통째로 선택**한다(interleave·dedup 아님):
 * snapshot 이 로컬과 같거나 길면 정본(snapshot), 짧으면 로컬을 그대로 채택. 복원(getStatus/SSE replay)이
 * 실어온 snapshot 이 아직 반영 못 한 최신 라이브 메시지(로컬이 더 김)를 stale snapshot 으로 되돌리지 않기
 * 위한 length-기반 선택이다. 분기 고정: widget-state.test.ts §mergeMessages.
 */
function mergeMessages(local: DisplayMessage[], snapshot: DisplayMessage[]): DisplayMessage[] {
  if (snapshot.length >= local.length) return snapshot;
  return local;
}
