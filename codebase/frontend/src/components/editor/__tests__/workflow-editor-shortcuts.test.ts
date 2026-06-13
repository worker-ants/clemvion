/**
 * §10.12 Escape 단축키 가드 로직 검증. WorkflowEditor 전체 렌더링은 WebSocket ·
 * ReactFlow · QueryClient 의존성이 많아 단위 테스트에 부적합하므로
 * (workflow-editor-debounce.test.ts 와 동일 정책), Escape 핸들러가 캔버스
 * 포커스 복귀를 양보할지 판정하는 순수 헬퍼 `isEditableTarget` 만 독립 검증한다.
 */
import { describe, it, expect } from "vitest";
import { isEditableTarget } from "../workflow-editor";

function el(tag: string, contentEditable = false): HTMLElement {
  const node = document.createElement(tag);
  if (contentEditable) node.setAttribute("contenteditable", "true");
  return node;
}

describe("isEditableTarget (§10.12 Escape 가드)", () => {
  it("treats INPUT / TEXTAREA / SELECT as editable (Escape 양보)", () => {
    expect(isEditableTarget(el("input"))).toBe(true);
    expect(isEditableTarget(el("textarea"))).toBe(true);
    expect(isEditableTarget(el("select"))).toBe(true);
  });

  it("treats contenteditable elements as editable", () => {
    expect(isEditableTarget(el("div", true))).toBe(true);
  });

  it("treats non-editable elements (button, div, timeline item) as non-editable (캔버스 복귀)", () => {
    expect(isEditableTarget(el("button"))).toBe(false);
    expect(isEditableTarget(el("div"))).toBe(false);
    expect(isEditableTarget(el("span"))).toBe(false);
  });
});
