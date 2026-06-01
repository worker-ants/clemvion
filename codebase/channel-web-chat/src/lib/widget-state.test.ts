import { describe, it, expect } from "vitest";
import { widgetReducer, initialState, type WidgetState } from "./widget-state";

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

  it("START: 첫 입력 → booting + 사용자 메시지", () => {
    const s = reduce([{ type: "OPEN" }, { type: "START", userText: "안녕" }]);
    expect(s.phase).toBe("booting");
    expect(s.messages.at(-1)).toMatchObject({ role: "user", text: "안녕" });
  });

  it("BOOTED → streaming + executionId", () => {
    const s = reduce([
      { type: "START", userText: "x" },
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

  it("NEW_CHAT → 초기화 + panel open", () => {
    const prev = reduce([
      { type: "START", userText: "x" },
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
});
