import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { SlideDrawer } from "../slide-drawer";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

// 닫힌 상태일 때 panel 에 `aria-hidden=true` + `inert` 가 붙어 RTL 기본 query 가
// 'hidden' 트리를 무시한다. 본 컴포넌트의 panel 자체는 항상 마운트돼 있으므로
// 테스트는 항상 hidden 포함으로 조회한다.
function getPanel(): HTMLElement {
  return screen.getByRole("dialog", { hidden: true });
}

describe("SlideDrawer", () => {
  it("side prop 이 없을 때 right 슬라이드로 렌더돼요 (기존 호출처 회귀 보호)", () => {
    render(
      <SlideDrawer open onClose={() => {}} title="T">
        body
      </SlideDrawer>,
    );
    const panel = getPanel();
    expect(panel).toHaveClass("right-0");
    expect(panel).toHaveClass("border-l");
    expect(panel).not.toHaveClass("left-0");
    expect(panel).not.toHaveClass("border-r");
  });

  it("side='right' 명시도 동일하게 right 슬라이드로 렌더돼요", () => {
    render(
      <SlideDrawer open onClose={() => {}} title="T" side="right">
        body
      </SlideDrawer>,
    );
    const panel = getPanel();
    expect(panel).toHaveClass("right-0");
    expect(panel).toHaveClass("border-l");
  });

  it("side='left' 일 때 left 슬라이드로 렌더돼요", () => {
    render(
      <SlideDrawer open onClose={() => {}} title="T" side="left">
        body
      </SlideDrawer>,
    );
    const panel = getPanel();
    expect(panel).toHaveClass("left-0");
    expect(panel).toHaveClass("border-r");
    expect(panel).not.toHaveClass("right-0");
    expect(panel).not.toHaveClass("border-l");
  });

  it("side='left' 가 닫힌 상태일 때 -translate-x-full (왼쪽 밖) 로 숨겨요", () => {
    render(
      <SlideDrawer open={false} onClose={() => {}} title="T" side="left">
        body
      </SlideDrawer>,
    );
    const panel = getPanel();
    expect(panel.className).toContain("-translate-x-full");
    expect(panel.className).not.toMatch(/(^|\s)translate-x-full(\s|$)/);
  });

  it("side='right' (default) 가 닫힌 상태일 때 translate-x-full (오른쪽 밖) 로 숨겨요", () => {
    render(
      <SlideDrawer open={false} onClose={() => {}} title="T">
        body
      </SlideDrawer>,
    );
    const panel = getPanel();
    expect(panel.className).toMatch(/(^|\s)translate-x-full(\s|$)/);
    expect(panel.className).not.toContain("-translate-x-full");
  });

  it("열림 상태에서는 side 와 무관하게 translate-x-0 로 안으로 들어와요", () => {
    const { rerender } = render(
      <SlideDrawer open onClose={() => {}} title="T" side="left">
        body
      </SlideDrawer>,
    );
    expect(getPanel().className).toContain("translate-x-0");

    rerender(
      <SlideDrawer open onClose={() => {}} title="T" side="right">
        body
      </SlideDrawer>,
    );
    expect(getPanel().className).toContain("translate-x-0");
  });

  it("Escape 키를 누르면 onClose 가 호출돼요 (side 와 무관)", () => {
    const onClose = vi.fn();
    render(
      <SlideDrawer open onClose={onClose} title="T" side="left">
        body
      </SlideDrawer>,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
