import { describe, it, expect } from "vitest";
import { isEditableTarget } from "../is-editable-target";

// 전역 단축키 가드용 순수 헬퍼. INPUT/TEXTAREA/SELECT/contentEditable = true.
// (workflow-editor 의 re-export 경유 테스트와 별개로 util 자체를 직접 검증.)
const el = (tag: string, contentEditable?: boolean): HTMLElement => {
  const node = document.createElement(tag);
  if (contentEditable) node.setAttribute("contenteditable", "true");
  return node;
};

describe("isEditableTarget", () => {
  it("입력류 요소는 true", () => {
    expect(isEditableTarget(el("input"))).toBe(true);
    expect(isEditableTarget(el("textarea"))).toBe(true);
    expect(isEditableTarget(el("select"))).toBe(true);
  });

  it("contenteditable 요소는 true (attribute 기반)", () => {
    expect(isEditableTarget(el("div", true))).toBe(true);
  });

  it("일반 요소는 false", () => {
    expect(isEditableTarget(el("button"))).toBe(false);
    expect(isEditableTarget(el("div"))).toBe(false);
    expect(isEditableTarget(el("span"))).toBe(false);
  });
});
