import { describe, it, expect } from "vitest";
import {
  widgetReducer,
  initialState,
  isActiveConversationPhase,
  isTextInputSurface,
  type WidgetPhase,
  type WidgetState,
} from "./widget-state";
import type { DisplayMessage } from "./conversation";

// 3곳(use-widget submitMessage·flush effect, panel Composer disabled)이 공유하는 핵심 판정 — 직접 단위 검증.
describe("isTextInputSurface — 자유 텍스트 표면 판정(§R6)", () => {
  it("ai_conversation → 텍스트 표면(true)", () => {
    expect(isTextInputSurface({ type: "ai_conversation" })).toBe(true);
  });
  it("null(ai_conversation 도달 전 과도 상태) → 텍스트 표면(true)", () => {
    expect(isTextInputSurface(null)).toBe(true);
  });
  it("buttons → 비텍스트 표면(false)", () => {
    expect(isTextInputSurface({ type: "buttons" })).toBe(false);
  });
  it("form → 비텍스트 표면(false)", () => {
    expect(isTextInputSurface({ type: "form" })).toBe(false);
  });
});

// 헤더 세션 컨트롤(새 대화/종료) 노출 게이트 — 대화 확립(streaming/awaiting) 에서만 true.
// booting 제외가 핵심(중복 webhook·미발사 cancel 차단, §2/§3.1) — WidgetPhase 7값 전수 진리표로 고정.
describe("isActiveConversationPhase — 세션 컨트롤 노출 게이트", () => {
  it.each<[WidgetPhase, boolean]>([
    ["collapsed", false],
    ["panel", false],
    ["booting", false], // webhook in-flight·세션 미확립 — 컨트롤 미노출(중복 webhook·미발사 cancel 방지)
    ["streaming", true],
    ["awaiting_user_message", true],
    ["ended", false],
    ["blocked", false],
  ])("phase=%s → %s", (phase, expected) => {
    expect(isActiveConversationPhase(phase)).toBe(expected);
  });
});

function reduce(actions: Parameters<typeof widgetReducer>[1][], from = initialState): WidgetState {
  return actions.reduce((s, a) => widgetReducer(s, a), from);
}

describe("widgetReducer", () => {
  it("OPEN: collapsed → panel, open, unread 리셋", () => {
    const s = reduce([{ type: "OPEN" }], { ...initialState, unread: 3 });
    expect(s.phase).toBe("panel");
    expect(s.open).toBe(true);
    expect(s.unread).toBe(0);
  });

  it("CLOSE: panel → collapsed(대화 phase 외엔), open=false", () => {
    const s = reduce([{ type: "OPEN" }, { type: "CLOSE" }]);
    expect(s.open).toBe(false);
    expect(s.phase).toBe("collapsed");
  });

  it("START: eager 시작(open 시) → booting, 사용자 메시지 없음(§R6)", () => {
    const s = reduce([{ type: "OPEN" }, { type: "START" }]);
    expect(s.phase).toBe("booting");
    expect(s.open).toBe(true);
    // eager 시작은 firstMessage 가 없으므로 메시지를 추가하지 않는다.
    expect(s.messages).toHaveLength(0);
  });

  it("BOOTED → streaming + executionId", () => {
    const s = reduce([
      { type: "START" },
      { type: "BOOTED", executionId: "e1" },
    ]);
    expect(s.phase).toBe("streaming");
    expect(s.executionId).toBe("e1");
  });

  it("WAITING → awaiting_user_message + pending", () => {
    const s = reduce([
      { type: "BOOTED", executionId: "e1" },
      { type: "WAITING", interaction: { type: "ai_conversation" } },
    ]);
    expect(s.phase).toBe("awaiting_user_message");
    expect(s.pending?.type).toBe("ai_conversation");
  });

  it("AI_MESSAGE: 패널 열림 → unread 증가 안 함", () => {
    const s = reduce([{ type: "OPEN" }, { type: "AI_MESSAGE", text: "응답" }]);
    expect(s.unread).toBe(0);
    expect(s.messages.at(-1)).toMatchObject({ role: "assistant", text: "응답" });
  });

  it("AI_MESSAGE: 패널 닫힘(in-flight) → unread 증가(N4)", () => {
    const s = reduce(
      [{ type: "AI_MESSAGE", text: "a" }, { type: "AI_MESSAGE", text: "b" }],
      { ...initialState, open: false },
    );
    expect(s.unread).toBe(2);
  });

  it("USER_MESSAGE: streaming + pending 해제 + 사용자 메시지", () => {
    const s = reduce([
      { type: "WAITING", interaction: { type: "ai_conversation" } },
      { type: "USER_MESSAGE", text: "질문" },
    ]);
    expect(s.phase).toBe("streaming");
    expect(s.pending).toBeNull();
    expect(s.messages.at(-1)).toMatchObject({ role: "user", text: "질문" });
  });

  // 종료 후 도착한 WAITING 은 무시한다(최후 방어선). 이 무조건 전이가 "종료된 위젯이
  // stale 응답으로 부활" 버그의 직접 원인이었다. 호출부 세대 가드가 근본 fix 지만, 리듀서는 모든
  // 경로가 통과하는 단일 지점이라 여기서도 막는다. (ai-review 2026-07-17 08_29_33 W4)
  it("ENDED 이후 WAITING → 무시(종료된 대화가 입력 표면으로 부활하지 않는다)", () => {
    const s = reduce([
      { type: "WAITING", interaction: { type: "buttons" } },
      { type: "ENDED" },
      {
        type: "WAITING",
        interaction: { type: "ai_conversation" },
        threadMessages: [{ role: "assistant", text: "유령", source: "live" }],
      },
    ]);
    expect(s.phase).toBe("ended");
    expect(s.pending).toBeNull();
    // 유령 메시지도 스레드에 섞이지 않는다.
    expect(s.messages.some((m) => m.text === "유령")).toBe(false);
  });

  // 가드가 **정당한 재개**를 막지 않는지 — `ended` 를 벗어나는 두 경로 모두 확인한다.
  // (`START` = eager 시작, `NEW_CHAT` = 대화 종료 후 새 대화라는 가장 흔한 흐름.)
  it.each<[string, Parameters<typeof widgetReducer>[1]]>([
    ["START", { type: "START" }],
    ["NEW_CHAT", { type: "NEW_CHAT" }],
  ])("%s 로 ended 를 벗어난 뒤의 WAITING 은 정상 동작(가드가 재개를 막지 않는다)", (_label, resume) => {
    const s = reduce([
      { type: "ENDED" },
      resume,
      { type: "WAITING", interaction: { type: "ai_conversation" } },
    ]);
    expect(s.phase).toBe("awaiting_user_message");
  });

  // A-6 — `ERROR` 는 세션을 정리하지 않는 유일한 종료 경로라, 저장 세션이 남은 채 host 가 `wc:boot`
  // 을 재전송하면 복원이 종료된 대화를 되살렸다(재현 확인 → `use-widget-eager-start.test.ts` 의
  // 통합 회귀 테스트). `WAITING` 과 같은 최후 방어선을 `RESTORED`/`BOOTED` 에도 확대한다.
  // (`08_29_33` W4 가 "실패 사례 없음"으로 보류했던 확대 — 트리거 충족)
  it.each<[string, Parameters<typeof widgetReducer>[1]]>([
    ["RESTORED", { type: "RESTORED", executionId: "e9" }],
    ["BOOTED", { type: "BOOTED", executionId: "e9" }],
  ])("%s: ENDED 이후엔 무시(종료된 대화가 streaming 으로 부활하지 않는다)", (_label, action) => {
    const s = reduce([{ type: "ENDED" }, action]);
    expect(s.phase).toBe("ended");
  });

  it("ENDED → ended + pending 해제", () => {
    const s = reduce([
      { type: "WAITING", interaction: { type: "buttons" } },
      { type: "ENDED" },
    ]);
    expect(s.phase).toBe("ended");
    expect(s.pending).toBeNull();
  });

  it("ERROR → ended + error 메시지", () => {
    const s = widgetReducer(initialState, { type: "ERROR", message: "410" });
    expect(s.phase).toBe("ended");
    expect(s.error).toBe("410");
  });

  it("ERROR(대기 중 pending 상태) → ended + pending 해제 + error", () => {
    // awaiting_user_message + pending 표면에서 에러가 나도 ended 로 전이하며 pending 을 비운다.
    const s = reduce([
      { type: "WAITING", interaction: { type: "buttons" } },
      { type: "ERROR", message: "network" },
    ]);
    expect(s.phase).toBe("ended");
    expect(s.pending).toBeNull();
    expect(s.error).toBe("network");
  });

  it("ended 재open: OPEN(ended 상태) → open=true, phase=ended 유지(종료 화면 재노출)", () => {
    // OPEN 은 collapsed 일 때만 panel 로 전이 — ended 는 그대로 유지해 '새 대화 시작' 화면을 다시 보여준다.
    const ended = reduce([
      { type: "WAITING", interaction: { type: "ai_conversation" } },
      { type: "ENDED" },
    ]);
    const s = widgetReducer({ ...ended, open: false }, { type: "OPEN" });
    expect(s.open).toBe(true);
    expect(s.phase).toBe("ended");
    expect(s.unread).toBe(0);
  });

  it("NEW_CHAT → 초기화 + panel open", () => {
    const prev = reduce([
      { type: "START" },
      { type: "AI_MESSAGE", text: "y" },
      { type: "ENDED" },
    ]);
    const s = widgetReducer(prev, { type: "NEW_CHAT" });
    expect(s.messages).toHaveLength(0);
    expect(s.phase).toBe("panel");
    expect(s.open).toBe(true);
  });

  it("RESTORED → streaming + executionId(새로고침 복원 N1)", () => {
    const s = widgetReducer(initialState, { type: "RESTORED", executionId: "e9" });
    expect(s.phase).toBe("streaming");
    expect(s.executionId).toBe("e9");
  });

  it("BLOCKED → phase blocked + open false(임베드 차단, 4-security §3-①)", () => {
    const opened = widgetReducer(initialState, { type: "OPEN" });
    const s = widgetReducer(opened, { type: "BLOCKED", reason: "origin_not_allowed" });
    expect(s.phase).toBe("blocked");
    expect(s.open).toBe(false);
    expect(s.error).toBe("origin_not_allowed");
  });

  it("AI_MESSAGE with presentations → 메시지에 presentations 전파 (I14)", () => {
    const pres = [{ config: { chartType: "bar" }, output: { data: [{ x: "a", y: 1 }] } }];
    const s = reduce([{ type: "AI_MESSAGE", text: "차트입니다", presentations: pres }]);
    const last = s.messages.at(-1);
    expect(last?.role).toBe("assistant");
    expect(last?.presentations).toHaveLength(1);
  });

  it("AI_MESSAGE with presentations: [] (빈) → presentations 미첨부 (I14)", () => {
    const s = reduce([{ type: "AI_MESSAGE", text: "응답", presentations: [] }]);
    const last = s.messages.at(-1);
    expect(last?.presentations).toBeUndefined();
  });

  // 위젯 가시성 축(show/hide) — open/close 와 직교 (1-widget-app §3.2)
  it("initial hidden=false", () => {
    expect(initialState.hidden).toBe(false);
  });

  it("HIDE: hidden=true, 패널 open·phase 유지(대화 유지, 화면만 숨김)", () => {
    const opened = reduce([{ type: "OPEN" }]);
    const s = widgetReducer(opened, { type: "HIDE" });
    expect(s.hidden).toBe(true);
    expect(s.open).toBe(true);
    expect(s.phase).toBe("panel");
  });

  it("SHOW: hidden=false 복귀, 직전 open 보존", () => {
    const hidden = reduce([{ type: "OPEN" }, { type: "HIDE" }]);
    const s = widgetReducer(hidden, { type: "SHOW" });
    expect(s.hidden).toBe(false);
    expect(s.open).toBe(true);
  });
});

// WAITING 의 threadMessages 병합(mergeMessages) — 새로고침 복원 시 getStatus/SSE 가 실어오는 durable
// conversationThread snapshot 과 로컬 라이브 메시지를 합치는 분기. mergeMessages 는 비공개라 유일한 공개
// 진입점인 WAITING 액션을 통해 두 분기(snapshot 채택 / local 보존)를 전수 고정한다.
// SoT: widget-state.ts mergeMessages, spec/7-channel-web-chat/1-widget-app §2·§3.
describe("widgetReducer — WAITING threadMessages 병합(mergeMessages, 복원 시드)", () => {
  const user = (text: string): DisplayMessage => ({ role: "user", text, source: "ai_user" });
  const bot = (text: string): DisplayMessage => ({ role: "assistant", text, source: "ai_assistant" });
  const waiting = (threadMessages?: DisplayMessage[]) =>
    ({ type: "WAITING", interaction: { type: "ai_conversation" }, threadMessages }) as const;

  it("빈 로컬 + snapshot → snapshot 으로 시드(role/text/순서 보존)", () => {
    const snapshot = [user("반품하고 싶어요"), bot("어떤 상품인가요?"), user("신발입니다")];
    const s = widgetReducer({ ...initialState, messages: [] }, waiting(snapshot));
    expect(s.messages).toEqual(snapshot);
    expect(s.messages.map((m) => m.role)).toEqual(["user", "assistant", "user"]);
    expect(s.phase).toBe("awaiting_user_message");
    expect(s.pending?.type).toBe("ai_conversation");
  });

  it("snapshot 이 로컬보다 김 → snapshot 채택(durable thread 가 부분 로컬을 대체)", () => {
    const local = [user("반품하고 싶어요")];
    const snapshot = [user("반품하고 싶어요"), bot("어떤 상품인가요?"), user("신발입니다")];
    const s = widgetReducer({ ...initialState, messages: local }, waiting(snapshot));
    expect(s.messages).toEqual(snapshot);
    expect(s.messages).toHaveLength(3);
  });

  it("snapshot == 로컬 길이(경계) → snapshot 우선(>= — durable 이 권위)", () => {
    // 같은 길이면 durable snapshot 을 신뢰한다(로컬 optimistic 대비 백엔드 정본 우선). `>` 가 아닌 `>=` 고정.
    const local = [user("옛 로컬 a"), bot("옛 로컬 b")];
    const snapshot = [user("정본 a"), bot("정본 b")];
    const s = widgetReducer({ ...initialState, messages: local }, waiting(snapshot));
    expect(s.messages).toEqual(snapshot);
    expect(s.messages.map((m) => m.text)).toEqual(["정본 a", "정본 b"]);
  });

  it("snapshot 이 로컬보다 짧음 → 로컬 보존(라이브 메시지를 stale 스냅샷이 덮지 않음)", () => {
    // getStatus/SSE replay 가 아직 반영 못한 최신 라이브 메시지가 있을 때, 더 짧은 스냅샷으로 되돌아가지 않는다.
    const local = [user("q1"), bot("a1"), user("q2"), bot("a2")];
    const snapshot = [user("q1"), bot("a1")];
    const s = widgetReducer({ ...initialState, messages: local }, waiting(snapshot));
    expect(s.messages).toEqual(local);
    expect(s.messages).toHaveLength(4);
  });

  it("빈 배열 스냅샷(threadMessages=[]) → local 비면 빈 유지, 비어있지 않으면 로컬 보존", () => {
    // 프로덕션 흔한 경로: conversationThread 가 빈(신규 대화 초입·첫 waiting) → threadToMessages([]) === [].
    // mergeMessages([], []) = [] (0>=0), mergeMessages(local, []) 는 local 유지 — 빈 스냅샷이 라이브 메시지를
    // 지우지 않는다(짧은 스냅샷 보존 규칙의 length-0 경계).
    const empty = widgetReducer({ ...initialState, messages: [] }, waiting([]));
    expect(empty.messages).toEqual([]);
    const local = [user("q1"), bot("a1")];
    const kept = widgetReducer({ ...initialState, messages: local }, waiting([]));
    expect(kept.messages).toEqual(local);
    expect(kept.messages).toHaveLength(2);
  });

  it("threadMessages 부재(undefined) WAITING → 기존 messages 불변(타입 레벨 방어 분기)", () => {
    // WAITING.threadMessages 는 optional 이지만 두 프로덕션 dispatch 호출부(use-widget.ts handleEiaEvent·
    // seedWaitingFromStatus)는 항상 threadToMessages(...) 배열을 전달한다(undefined 미도달). 따라서 이 분기는
    // 리듀서 타입 계약상의 방어 코드로, 도달 시 표면(pending)만 갱신하고 messages 참조를 재할당하지 않음을 고정한다.
    const local = [user("q1"), bot("a1")];
    const s = widgetReducer({ ...initialState, messages: local }, waiting(undefined));
    expect(s.messages).toBe(local); // 참조까지 동일(불필요한 재할당 없음)
    expect(s.pending?.type).toBe("ai_conversation");
  });
});