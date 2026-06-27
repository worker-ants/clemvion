import { describe, it, expect } from "vitest";
import {
  widgetReducer,
  initialState,
  isTextInputSurface,
  type WidgetState,
} from "./widget-state";

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