import { afterEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, screen, fireEvent } from "@testing-library/react";
import { SlideDrawer, __resetForTesting } from "../slide-drawer";

afterEach(() => {
  cleanup();
  // W-10: openDrawerCount 리셋 — 테스트 간 카운터 오염 방지.
  __resetForTesting();
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

  // W-4: overlay 클릭 / 닫기 버튼 클릭 → onClose 호출
  it("overlay 클릭 시 onClose 가 호출돼요 (W-4)", () => {
    const onClose = vi.fn();
    const { container } = render(
      <SlideDrawer open onClose={onClose} title="T">
        body
      </SlideDrawer>,
    );
    // Overlay 는 panel 바로 앞의 fixed div (aria role 없음, bg-black/50).
    // querySelector 로 fixed inset-0 overlay 를 찾아 클릭.
    const overlay = container.querySelector(".fixed.inset-0");
    expect(overlay).not.toBeNull();
    fireEvent.click(overlay!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("닫기(X) 버튼 클릭 시 onClose 가 호출돼요 (W-4)", () => {
    const onClose = vi.fn();
    render(
      <SlideDrawer open onClose={onClose} title="T">
        body
      </SlideDrawer>,
    );
    // 테스트 locale 은 ko 기본값 — aria-label 은 "닫기" (common.close).
    // 영문 매칭을 피하기 위해 한국어 패턴 사용.
    const closeBtn = screen.getByRole("button", { name: /닫기/ });
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  // W-3: body scroll lock — 열림 시 overflow hidden, 닫힘 시 복원, 중첩 시나리오
  it("열릴 때 body scroll 이 잠기고 닫힐 때 복원돼요 (W-3)", () => {
    const { rerender } = render(
      <SlideDrawer open={false} onClose={() => {}} title="T">
        body
      </SlideDrawer>,
    );
    expect(document.body.style.overflow).toBe("");

    rerender(
      <SlideDrawer open onClose={() => {}} title="T">
        body
      </SlideDrawer>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    rerender(
      <SlideDrawer open={false} onClose={() => {}} title="T">
        body
      </SlideDrawer>,
    );
    expect(document.body.style.overflow).toBe("");
  });

  it("두 drawer 가 중첩될 때 첫 번째가 닫혀도 scroll lock 이 유지돼요 (W-3 중첩 시나리오)", () => {
    const { rerender: rerender1, unmount: unmount1 } = render(
      <SlideDrawer open onClose={() => {}} title="T1">
        body1
      </SlideDrawer>,
    );
    const { rerender: rerender2 } = render(
      <SlideDrawer open onClose={() => {}} title="T2">
        body2
      </SlideDrawer>,
    );
    // 두 drawer 모두 열려있는 상태 → lock 유지
    expect(document.body.style.overflow).toBe("hidden");

    // 첫 번째 닫힘 — 두 번째가 아직 열려있으므로 lock 유지
    rerender1(
      <SlideDrawer open={false} onClose={() => {}} title="T1">
        body1
      </SlideDrawer>,
    );
    expect(document.body.style.overflow).toBe("hidden");

    // 두 번째도 닫힘 → lock 해제
    rerender2(
      <SlideDrawer open={false} onClose={() => {}} title="T2">
        body2
      </SlideDrawer>,
    );
    expect(document.body.style.overflow).toBe("");

    unmount1();
  });
});
