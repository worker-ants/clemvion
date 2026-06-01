import { describe, it, expect } from "vitest";
import { stripUserInputMarkers, threadToMessages } from "./conversation";
import type { ConversationThread } from "./eia-types";

describe("stripUserInputMarkers", () => {
  it("[user-input] 여닫는 마커 제거", () => {
    expect(stripUserInputMarkers("[user-input]내 질문[/user-input]")).toBe("내 질문");
  });
  it("마커 없으면 그대로", () => {
    expect(stripUserInputMarkers("그냥 텍스트")).toBe("그냥 텍스트");
  });
  it("여러 마커 모두 제거", () => {
    expect(stripUserInputMarkers("[user-input]a[/user-input] b [user-input]c[/user-input]")).toBe(
      "a b c",
    );
  });
});

describe("threadToMessages", () => {
  it("turns 를 표시 메시지로 변환 + 마커 strip", () => {
    const thread: ConversationThread = {
      turns: [
        { source: "live", role: "user", text: "[user-input]안녕[/user-input]" },
        { source: "live", role: "assistant", text: "반갑습니다" },
      ],
    };
    const msgs = threadToMessages(thread);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: "user", text: "안녕", source: "live" });
    expect(msgs[1]).toMatchObject({ role: "assistant", text: "반갑습니다" });
  });

  it("source 누락 시 live 폴백", () => {
    const msgs = threadToMessages({ turns: [{ text: "x" }] });
    expect(msgs[0].source).toBe("live");
  });

  it("injected source 보존", () => {
    const msgs = threadToMessages({ turns: [{ source: "injected", text: "주입" }] });
    expect(msgs[0].source).toBe("injected");
  });

  it("빈/누락 thread 는 빈 배열", () => {
    expect(threadToMessages(undefined)).toEqual([]);
    expect(threadToMessages({ turns: [] })).toEqual([]);
  });

  it("빈 텍스트 turn 은 제외", () => {
    const msgs = threadToMessages({ turns: [{ text: "" }, { text: "유효" }] });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("유효");
  });
});

describe("threadToMessages — presentations 처리 (I13)", () => {
  it("presentations-only turn(text 없음) → 메시지에 포함", () => {
    const msgs = threadToMessages({
      turns: [
        { role: "assistant", presentations: [{ config: { chartType: "bar" }, output: { data: [] } }] },
      ],
    });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("");
    expect(msgs[0].presentations).toHaveLength(1);
  });

  it("text + presentations 동시 존재 → 둘 다 포함", () => {
    const msgs = threadToMessages({
      turns: [
        {
          role: "assistant",
          text: "차트를 확인하세요",
          presentations: [{ config: { chartType: "pie" }, output: { data: [] } }],
        },
      ],
    });
    expect(msgs[0].text).toBe("차트를 확인하세요");
    expect(msgs[0].presentations).toHaveLength(1);
  });

  it("presentations: [] (빈 배열) 인 turn → 텍스트 없으면 필터", () => {
    const msgs = threadToMessages({
      turns: [
        { role: "assistant", text: "", presentations: [] },
        { role: "assistant", text: "유효" },
      ],
    });
    // presentations 빈 배열 + text 없음 → 포함하지 않음(filter 조건).
    expect(msgs).toHaveLength(1);
    expect(msgs[0].text).toBe("유효");
  });
});
