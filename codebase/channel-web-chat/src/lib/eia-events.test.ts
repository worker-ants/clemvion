import { describe, it, expect } from "vitest";
import { parseWaitingForInput, parseAiMessage, parseMessage } from "./eia-events";
import type {
  WaitingForInputEvent,
  AiMessageEvent,
  ExecutionMessageEvent,
} from "./eia-types";

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

  it("interactionType 두 필드 모두 없을 때 'ai_conversation' 기본값 (INFO-5)", () => {
    // top-level interactionType 도 nodeOutput.interactionType 도 없는 최소 픽스처
    const ev = { waitingNodeId: "n-default" } as unknown as WaitingForInputEvent;
    const r = parseWaitingForInput(ev);
    expect(r.type).toBe("ai_conversation");
    expect(r.nodeId).toBe("n-default");
  });

  it("form: formConfig 없으면 nodeOutput 자체가 config fallback (INFO-6)", () => {
    // formConfig 키 없이 nodeOutput 에 직접 fields 가 있는 wire 형태
    const ev = {
      waitingNodeId: "n-form-fallback",
      interactionType: "form",
      nodeOutput: { fields: [{ name: "x", label: "X" }] },
    } as unknown as WaitingForInputEvent;
    const r = parseWaitingForInput(ev);
    expect(r.type).toBe("form");
    expect(r.nodeId).toBe("n-form-fallback");
    // nodeOutput 전체가 config 로 노출 — formConfig fallback 의도된 동작
    expect((r.config as { fields: unknown[] })?.fields?.[0]).toMatchObject({ name: "x" });
  });
});

describe("parseAiMessage — SSE wire 형태 매핑", () => {
  it("message → text (text 필드 아님)", () => {
    const ev = { message: "안녕하세요, 제품을 소개해 드릴게요.", turnCount: 1 } as AiMessageEvent;
    const r = parseAiMessage(ev);
    expect(r.text).toBe("안녕하세요, 제품을 소개해 드릴게요.");
    expect(r.presentations).toBeUndefined();
  });

  it("presentations 빈 배열은 undefined 로 정규화 (INFO-8a)", () => {
    expect(parseAiMessage({ message: "", presentations: [] } as AiMessageEvent).presentations).toBeUndefined();
  });

  it("presentations 비빈 배열은 그대로 전달 (INFO-8b)", () => {
    const r = parseAiMessage({ message: "x", presentations: [{ kind: "carousel" }] } as AiMessageEvent);
    expect(r.presentations?.length).toBe(1);
    expect(r.presentations?.[0]).toMatchObject({ kind: "carousel" });
  });

  it("구 형태 .text 는 무시 — message 없으면 빈 문자열", () => {
    const r = parseAiMessage({ text: "legacy" } as unknown as AiMessageEvent);
    expect(r.text).toBe("");
  });
});

describe("parseMessage — execution.message(presentation 노드 자동 진행) 매핑", () => {
  it("template 노드: {config, output} envelope 를 presentations 로 그대로 전달", () => {
    // 백엔드 execution-engine 이 비차단 presentation 완료 시 발행하는 wire payload 축약.
    const ev = {
      nodeId: "n-template",
      nodeType: "template",
      presentations: [
        { config: { outputFormat: "markdown" }, output: { rendered: "**안내** 메시지" } },
      ],
    } as unknown as ExecutionMessageEvent;
    const r = parseMessage(ev);
    expect(r.presentations?.length).toBe(1);
    // 위젯 classifyPresentation/toTemplate 가 읽는 envelope 그대로(변환 없음).
    expect(r.presentations?.[0]).toMatchObject({
      config: { outputFormat: "markdown" },
      output: { rendered: "**안내** 메시지" },
    });
  });

  it("presentations 빈 배열은 undefined 로 정규화 (parseAiMessage 와 동일 규약)", () => {
    expect(
      parseMessage({ presentations: [] } as unknown as ExecutionMessageEvent).presentations,
    ).toBeUndefined();
  });

  it("presentations 누락 시 undefined", () => {
    expect(parseMessage({ nodeType: "template" } as ExecutionMessageEvent).presentations).toBeUndefined();
  });

  it("carousel 노드: config.layout + output.items envelope 그대로 전달", () => {
    const ev = {
      nodeId: "n-carousel",
      nodeType: "carousel",
      presentations: [
        { config: { layout: "card" }, output: { items: [{ title: "A" }, { title: "B" }] } },
      ],
    } as unknown as ExecutionMessageEvent;
    const r = parseMessage(ev);
    expect(r.presentations?.[0]).toMatchObject({
      config: { layout: "card" },
      output: { items: [{ title: "A" }, { title: "B" }] },
    });
  });

  it("table 노드: output.rows/columns envelope 그대로 전달", () => {
    const ev = {
      nodeId: "n-table",
      nodeType: "table",
      presentations: [
        {
          config: { columns: [{ field: "name", label: "이름" }] },
          output: { rows: [{ name: "홍길동" }] },
        },
      ],
    } as unknown as ExecutionMessageEvent;
    const r = parseMessage(ev);
    expect(r.presentations?.[0]).toMatchObject({
      output: { rows: [{ name: "홍길동" }] },
    });
  });

  it("chart 노드: config.chartType + output.data envelope 그대로 전달", () => {
    const ev = {
      nodeId: "n-chart",
      nodeType: "chart",
      presentations: [
        {
          config: { chartType: "bar" },
          output: { data: [{ x: "1월", y: 10 }, { x: "2월", y: 20 }] },
        },
      ],
    } as unknown as ExecutionMessageEvent;
    const r = parseMessage(ev);
    expect(r.presentations?.[0]).toMatchObject({
      config: { chartType: "bar" },
      output: { data: [{ x: "1월", y: 10 }, { x: "2월", y: 20 }] },
    });
  });
});
