import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import {
  findFirstTriggerNode,
  hasOnlyTriggerNodes,
  isTriggerNode,
  isWorkflowEmpty,
} from "../is-trigger";

function node(id: string, data: Record<string, unknown>): Node {
  return { id, position: { x: 0, y: 0 }, data } as Node;
}

describe("isTriggerNode", () => {
  it("category=trigger 면 true", () => {
    expect(isTriggerNode(node("1", { category: "trigger", type: "manual_trigger" }))).toBe(true);
    expect(isTriggerNode(node("2", { category: "trigger", type: "webhook_trigger" }))).toBe(true);
  });

  it("category가 없어도 type=manual_trigger 면 true (폴백)", () => {
    expect(isTriggerNode(node("3", { type: "manual_trigger" }))).toBe(true);
  });

  it("다른 카테고리는 false", () => {
    expect(isTriggerNode(node("4", { category: "logic", type: "if_else" }))).toBe(false);
    expect(isTriggerNode(node("5", { category: "ai", type: "ai_agent" }))).toBe(false);
  });

  it("data가 비어있으면 false", () => {
    expect(isTriggerNode(node("6", {}))).toBe(false);
  });
});

describe("hasOnlyTriggerNodes", () => {
  it("모든 노드가 trigger 면 true", () => {
    const nodes = [
      node("1", { category: "trigger", type: "manual_trigger" }),
    ];
    expect(hasOnlyTriggerNodes(nodes)).toBe(true);
  });

  it("비트리거 노드가 섞여 있으면 false", () => {
    const nodes = [
      node("1", { category: "trigger", type: "manual_trigger" }),
      node("2", { category: "logic", type: "if_else" }),
    ];
    expect(hasOnlyTriggerNodes(nodes)).toBe(false);
  });

  it("빈 배열이면 false", () => {
    expect(hasOnlyTriggerNodes([])).toBe(false);
  });
});

describe("isWorkflowEmpty", () => {
  it("빈 배열이면 true", () => {
    expect(isWorkflowEmpty([])).toBe(true);
  });

  it("trigger 1개만 있으면 true", () => {
    expect(
      isWorkflowEmpty([node("1", { category: "trigger", type: "manual_trigger" })]),
    ).toBe(true);
  });

  it("trigger + 다른 노드가 있으면 false", () => {
    expect(
      isWorkflowEmpty([
        node("1", { category: "trigger", type: "manual_trigger" }),
        node("2", { category: "logic", type: "if_else" }),
      ]),
    ).toBe(false);
  });

  it("비트리거 노드만 있어도 false", () => {
    expect(
      isWorkflowEmpty([node("1", { category: "logic", type: "if_else" })]),
    ).toBe(false);
  });
});

describe("findFirstTriggerNode", () => {
  it("노드 목록에서 첫 trigger 를 찾아요", () => {
    const t = node("1", { category: "trigger", type: "manual_trigger" });
    const l = node("2", { category: "logic", type: "if_else" });
    expect(findFirstTriggerNode([l, t])).toBe(t);
  });

  it("없으면 undefined", () => {
    expect(
      findFirstTriggerNode([node("1", { category: "logic", type: "if_else" })]),
    ).toBeUndefined();
  });
});
