import { describe, it, expect } from "vitest";
import { parseWaitingForInput, parseAiMessage } from "./eia-events";
import type { WaitingForInputEvent, AiMessageEvent } from "./eia-types";

describe("parseWaitingForInput — SSE wire 형태 매핑", () => {
  it("ai_conversation: waitingNodeId → nodeId, nodeOutput.conversationConfig → config (실제 wire 캡처)", () => {
    // 실제 SSE 캡처(execution.waiting_for_input) 의 축약 — 필드명이 핵심.
    const ev = {
      status: "waiting_for_input",
      waitingNodeId: "abf59450-2aef-483f-8293-0b936a53cef0",
      waitingNodeType: "ai_agent",
      interactionType: "ai_conversation",
      conversationThread: { id: "default", nextSeq: 0, turns: [], totalChars: 0 },
      nodeOutput: {
        interactionType: "ai_conversation",
        config: { mode: "multi_turn" },
        conversationConfig: { message: "", turnCount: 0, messages: [], maxTurns: 0 },
      },
    } as unknown as WaitingForInputEvent;
    const r = parseWaitingForInput(ev);
    expect(r.type).toBe("ai_conversation");
    expect(r.nodeId).toBe("abf59450-2aef-483f-8293-0b936a53cef0"); // submit_message 의 nodeId
    expect(r.config).toEqual({ message: "", turnCount: 0, messages: [], maxTurns: 0 });
    expect(r.conversationThread?.turns).toEqual([]);
  });

  it("buttons: buttonConfig → config (.buttons 포함)", () => {
    const ev = {
      waitingNodeId: "n-btn",
      interactionType: "buttons",
      buttonConfig: { buttons: [{ label: "예" }, { label: "아니오" }] },
    } as unknown as WaitingForInputEvent;
    const r = parseWaitingForInput(ev);
    expect(r.type).toBe("buttons");
    expect(r.nodeId).toBe("n-btn");
    expect((r.config?.buttons as unknown[])?.length).toBe(2);
  });

  it("form: nodeOutput(.formConfig 우선) → config", () => {
    const ev = {
      waitingNodeId: "n-form",
      interactionType: "form",
      nodeOutput: { formConfig: { fields: [{ name: "email" }] } },
    } as unknown as WaitingForInputEvent;
    const r = parseWaitingForInput(ev);
    expect(r.type).toBe("form");
    expect(r.nodeId).toBe("n-form");
    expect(r.config).toEqual({ fields: [{ name: "email" }] });
  });

  it("interactionType top-level 누락 시 nodeOutput.interactionType fallback", () => {
    const ev = {
      waitingNodeId: "n",
      nodeOutput: { interactionType: "ai_conversation", conversationConfig: { x: 1 } },
    } as unknown as WaitingForInputEvent;
    const r = parseWaitingForInput(ev);
    expect(r.type).toBe("ai_conversation");
    expect(r.config).toEqual({ x: 1 });
  });

  it("구 notification 형태(node.id/context)는 매핑 안 됨 — 회귀 방지(nodeId undefined)", () => {
    const legacy = {
      node: { id: "should-not-be-read", interactionType: "ai_conversation" },
      context: { conversationConfig: { y: 2 } },
    } as unknown as WaitingForInputEvent;
    const r = parseWaitingForInput(legacy);
    expect(r.nodeId).toBeUndefined(); // wire 형태가 아니므로 nodeId 없음 — 의도된 동작
  });
});

describe("parseAiMessage — SSE wire 형태 매핑", () => {
  it("message → text (text 필드 아님)", () => {
    const ev = { message: "안녕하세요, 제품을 소개해 드릴게요.", turnCount: 1 } as AiMessageEvent;
    const r = parseAiMessage(ev);
    expect(r.text).toBe("안녕하세요, 제품을 소개해 드릴게요.");
    expect(r.presentations).toBeUndefined();
  });

  it("presentations 동봉 시 전달, 빈 배열은 undefined", () => {
    expect(parseAiMessage({ message: "", presentations: [] } as AiMessageEvent).presentations).toBeUndefined();
    const r = parseAiMessage({ message: "x", presentations: [{ kind: "carousel" }] } as AiMessageEvent);
    expect(r.presentations?.length).toBe(1);
  });

  it("구 형태 .text 는 무시 — message 없으면 빈 문자열", () => {
    const r = parseAiMessage({ text: "legacy" } as unknown as AiMessageEvent);
    expect(r.text).toBe("");
  });
});
