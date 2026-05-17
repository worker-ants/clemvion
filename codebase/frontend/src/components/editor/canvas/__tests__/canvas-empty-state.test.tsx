import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CanvasEmptyState } from "../canvas-empty-state";

describe("CanvasEmptyState", () => {
  it("visible=true면 시작하기 제목과 aria-label을 노출해요", () => {
    render(<CanvasEmptyState visible={true} />);
    expect(
      screen.getByRole("region", { name: "시작하기" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("워크플로우를 이어서 완성해봐요"),
    ).toBeInTheDocument();
  });

  it("트리거 기준 3단계 체크리스트를 렌더해요", () => {
    render(<CanvasEmptyState visible={true} />);
    expect(
      screen.getByText("팔레트에서 다음 노드를 드래그해요"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("트리거 출력 포트에 연결해요"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("실행해서 결과를 확인해요"),
    ).toBeInTheDocument();
  });

  it("시작 가이드 링크는 새 탭으로 열려요", () => {
    render(<CanvasEmptyState visible={true} />);
    const cta = screen.getByRole("link", { name: /시작 가이드 열기/ });
    expect(cta).toHaveAttribute(
      "href",
      "/docs/01-getting-started/first-workflow",
    );
    expect(cta).toHaveAttribute("target", "_blank");
    expect(cta).toHaveAttribute("rel", expect.stringContaining("noopener"));
  });

  it("각 단계의 '자세히' 링크는 매뉴얼 딥링크로 새 탭에서 열려요", () => {
    render(<CanvasEmptyState visible={true} />);
    const detailLinks = screen.getAllByRole("link", { name: "자세히" });
    expect(detailLinks).toHaveLength(3);
    for (const link of detailLinks) {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link.getAttribute("href")).toMatch(/^\/docs\//);
    }
  });

  it("보조 CTA 버튼은 없이 '시작 가이드 열기' 링크만 노출해요", () => {
    render(<CanvasEmptyState visible={true} />);
    expect(
      screen.queryByRole("button", { name: /노드 추가/ }),
    ).toBeNull();
    expect(
      screen.getByRole("link", { name: /시작 가이드 열기/ }),
    ).toBeInTheDocument();
  });

  it("닫기 버튼을 누르면 카드가 숨겨져요", () => {
    const { container } = render(<CanvasEmptyState visible={true} />);
    const region = container.querySelector(
      '[aria-label="시작하기"]',
    ) as HTMLElement;
    expect(region).toHaveAttribute("data-visible", "true");

    fireEvent.click(
      screen.getByRole("button", { name: "시작 가이드 닫기" }),
    );

    expect(region).toHaveAttribute("data-visible", "false");
    expect(region).toHaveAttribute("aria-hidden", "true");
    expect(region.className).toContain("opacity-0");
    expect(region.className).toContain("pointer-events-none");
  });

  it("visible=false로 바뀌면 aria-hidden + opacity-0로 숨겨지고 DOM은 유지돼요", () => {
    const { rerender, container } = render(
      <CanvasEmptyState visible={true} />,
    );
    const region = container.querySelector(
      '[aria-label="시작하기"]',
    ) as HTMLElement;
    expect(region).toHaveAttribute("data-visible", "true");
    expect(region.className).toContain("opacity-100");

    rerender(<CanvasEmptyState visible={false} />);
    expect(region).toHaveAttribute("data-visible", "false");
    expect(region).toHaveAttribute("aria-hidden", "true");
    expect(region.className).toContain("opacity-0");
    expect(region.className).toContain("pointer-events-none");
  });
});
