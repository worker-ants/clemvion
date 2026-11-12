// 위젯 상태기계 reducer. SoT: spec/7-channel-web-chat/1-widget-app §3·§3.1.
// phase: collapsed → (open) panel(transient) → booting(eager 시작) → streaming ↔ awaiting_user_message → ended.
// 워크플로우는 패널 open 시 시작한다(eager, §R6) — 첫 사용자 입력을 기다리지 않으며 firstMessage 미사용.

import type { DisplayMessage } from "./conversation";
import type { ExternalInteractionType, InteractCommand } from "./eia-types";

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
  /**
   * 명령 실패 안내(catalog `error.commandFailed`)를 보일지. 명령이 실패했지만 종료가 확정되지 않았을 때
   * 켠다(REQ-WCWIDGET-053). 다음 명령을 보내거나 새 대기 표면을 받으면 끈다(REQ-WCWIDGET-056).
   */
  commandFailed?: boolean;
  /** Form 검증 실패(`400 VALIDATION_ERROR`)의 필드별 문구. 키는 `details[].field` 다(REQ-WCWIDGET-041). */
  fieldErrors?: Record<string, string>;
  /**
   * 입력창에 되돌릴 글(REQ-WCWIDGET-054). Composer 는 이 **객체가 바뀔 때** 한 번 반영한다.
   * 같은 글을 두 번 되돌려도 다시 반영되도록 문자열이 아니라 객체로 둔다.
   */
  composerDraft?: { text: string };
  /**
   * 응답을 확인하지 못한 채 낙관적으로 그린 사용자 메시지와 그 직전 표면. 메시지 전송이 실패하면 이 값으로
   * 되돌린다. 서버가 처리했다는 신호(새 응답 · 새 대기 표면)나 종료가 오면 지운다. 그래서 이 값이 남아 있으면
   * 마지막 메시지가 아직 그 말풍선이다.
   */
  unconfirmedSend?: { text: string; pending: PendingInteraction | null; localId?: string };
}

let localIdSeq = 0;
/** 메시지 전송 하나를 가리키는 식별자. `USER_MESSAGE` 와 그 명령의 `COMMAND_FAILED` 를 묶는다. */
export function newLocalId(): string {
  localIdSeq += 1;
  return `m${localIdSeq}`;
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
  | {
      type: "WAITING";
      interaction: PendingInteraction;
      threadMessages?: DisplayMessage[];
      /** 명령 `409` 뒤 재동기화면 true. 방금 띄운 실패 안내와 필드 문구를 지우지 않는다. */
      keepCommandFeedback?: boolean;
    }
  | { type: "AI_MESSAGE"; text: string; presentations?: Array<Record<string, unknown>> }
  | { type: "USER_MESSAGE"; text: string; localId?: string }
  /** 명령을 보내기 직전. 지난 명령 실패 안내와 필드 문구를 지운다(REQ-WCWIDGET-056). */
  | { type: "COMMAND_SENT" }
  /**
   * 종료로 확정되지 않은 명령 실패(REQ-WCWIDGET-053). `fieldErrors` 가 있으면 Form 검증 실패라 일반 안내 대신
   * 필드 문구만 보인다(REQ-WCWIDGET-041).
   */
  | {
      type: "COMMAND_FAILED";
      command: InteractCommand["command"];
      fieldErrors?: Record<string, string>;
      /** 실패한 전송의 `USER_MESSAGE.localId`. 다른 전송의 낙관적 말풍선을 되돌리지 않으려고 일치할 때만 되돌린다. */
      localId?: string;
    }
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
      // **`ended` 가드를 두지 않는다 — 복원은 서버 상태가 결정한다.**
      //
      // 한때 여기(와 `BOOTED`)에 `if (state.phase === "ended") return state;` 를 뒀다. "실패해
      // 끝난 대화가 `wc:boot` 재전송으로 되살아난다" 를 막으려던 것이다. 그 전제가 틀렸다 —
      // 이 가드가 실제로 발화할 수 있는 유일한 상황이 **spec 이 복원하라고 명시한 상황**이었다:
      //
      //   `3-auth-session.md` §3.1-3 이 storage 를 지우는 종료 경로(SSE terminal·410·404·
      //   200+terminal)는 **전부 저장 세션을 함께 지운다** → 재부팅 시 `loadSession` 이 `null` →
      //   `RESTORED` 자체가 오지 않는다. 즉 `ended` 인 채로 `RESTORED` 가 도달하려면 storage 가
      //   살아남아야 하고, 그건 비-410 명령 실패(일시적 500·네트워크 순단)뿐이다. 그리고 그
      //   경우 §3.1-2 는 "200 + running → 복원" 을 **명시적으로 요구한다**.
      //
      // 그래서 이 가드는 "부활 방지" 가 아니라 **살아있는 대화의 복원 차단**이었다.
      // (ai-review 2026-07-17 18_39_11 requirement CRITICAL — 실측 귀속)
      //
      // `WAITING` 의 `ended` 가드는 유지된다 — 그건 다른 것을 막는다(world 가 바뀐 뒤 도착한
      // **옛 세계의** stale seed. 각 case 주석 참조).
      return { ...state, executionId: action.executionId, phase: "streaming" };
    case "BOOTED":
      // `START`(→`booting`) 직후에만 오므로 `ended` 에서 도달 불가 — `RESTORED` 와 대칭으로 무가드.
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
      // **가드 범위**: `WAITING` **에만** 있다. 한때 `RESTORED`/`BOOTED` 로 확대했다가 되돌렸다 —
      // 거기선 이 가드가 spec 이 요구하는 복원을 막았다(`RESTORED` case 주석 참조). 두 축이 다르다:
      // 여기서 막는 건 "**world 가 바뀐 뒤** 도착한 옛 세계의 seed" 이고, `RESTORED` 가 나르는 건
      // "world 가 그대로인 **살아있는** 세션" 이다. `USER_MESSAGE` 도 무가드 — 실패 사례가 없어
      // 넓히지 않았다(C1 이 보여줬듯 "명백히 안전해 보이는" 가드가 영구 정지를 만들 수 있고,
      // `RESTORED` 가 바로 그 재발이었다).
      // (ai-review 2026-07-17 08_29_33 W4 / 17_36_57 documentation / 18_39_11 requirement)
      if (state.phase === "ended") return state;
      return {
        ...state,
        ...(action.keepCommandFeedback ? { unconfirmedSend: undefined } : CLEARED_COMMAND_FEEDBACK),
        phase: "awaiting_user_message",
        pending: action.interaction,
        messages: action.threadMessages
          ? mergeMessages(state.messages, action.threadMessages)
          : state.messages,
      };
    case "AI_MESSAGE":
      return {
        ...state,
        // 응답이 왔으면 서버가 앞선 메시지를 처리했다 — 나중에 그 명령이 실패로 끝나도 되돌리지 않는다.
        unconfirmedSend: undefined,
        messages: [...state.messages, assistantMsg(action.text, action.presentations)],
        // 패널 닫힌 채 도착한 in-flight 메시지 → unread(N4).
        unread: state.open ? state.unread : state.unread + 1,
      };
    case "USER_MESSAGE":
      return {
        ...state,
        commandFailed: undefined,
        fieldErrors: undefined,
        composerDraft: undefined,
        unconfirmedSend: { text: action.text, pending: state.pending, localId: action.localId },
        phase: "streaming",
        pending: null,
        messages: [...state.messages, userMsg(action.text)],
      };
    case "COMMAND_SENT":
      // 지울 것이 없으면 같은 객체를 돌려줘 다시 그리지 않는다(명령마다 발행된다).
      if (!state.commandFailed && !state.fieldErrors) return state;
      return { ...state, commandFailed: undefined, fieldErrors: undefined };
    case "COMMAND_FAILED":
      return applyCommandFailure(state, action.command, action.fieldErrors, action.localId);
    case "ENDED":
      return { ...state, ...CLEARED_COMMAND_FEEDBACK, phase: "ended", pending: null };
    case "ERROR":
      return { ...state, ...CLEARED_COMMAND_FEEDBACK, phase: "ended", pending: null, error: action.message };
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

/** 종료 · 새 대기 표면에서 함께 지우는 명령 실패 표시. `composerDraft` 는 사용자 입력이라 남긴다. */
const CLEARED_COMMAND_FEEDBACK = {
  commandFailed: undefined,
  fieldErrors: undefined,
  unconfirmedSend: undefined,
} as const satisfies Partial<WidgetState>;

/**
 * 종료로 확정되지 않은 명령 실패를 화면에 반영한다(CLE-WEBCHAT-WIDGET 「명령 실패」).
 *
 * `[ended]` 로 가지 않는다. 메시지 전송이 실패했고 그 뒤 SSE 로 응답이나 대기 표면이 오지 않았으면
 * 낙관적으로 그린 말풍선을 거두고 보낸 글을 입력창에 되돌린다(REQ-WCWIDGET-054). 응답이 이미 왔으면
 * 서버가 처리한 것이라 안내만 보인다. 그 판정은 `unconfirmedSend` 가 남아 있는지 하나로 한다(응답 · 대기
 * 표면이 오면 지운다). 이미 끝났거나 차단된 화면은 바꾸지 않는다.
 */
function applyCommandFailure(
  state: WidgetState,
  command: InteractCommand["command"],
  fieldErrors: Record<string, string> | undefined,
  localId: string | undefined,
): WidgetState {
  if (state.phase === "ended" || state.phase === "blocked") return state;
  const next: WidgetState = {
    ...state,
    commandFailed: fieldErrors ? undefined : true,
    fieldErrors,
  };
  const sent = state.unconfirmedSend;
  // 슬롯은 마지막 전송 하나만 담는다. 실패한 전송이 그 전송이 아니면(겹친 전송) 말풍선을 거두지 않는다.
  if (command !== "submit_message" || !sent || sent.localId !== localId) return next;
  return {
    ...next,
    phase: "awaiting_user_message",
    pending: sent.pending,
    messages: state.messages.slice(0, -1),
    composerDraft: { text: sent.text },
    unconfirmedSend: undefined,
  };
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
