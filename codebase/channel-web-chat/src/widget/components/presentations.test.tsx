import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresentationBlock, PresentationList } from "./presentations";

describe("PresentationBlock — 종류별 렌더", () => {
  it("carousel — title/desc 렌더 + nav(복수) + port 버튼 디스패치", () => {
    const onButton = vi.fn();
    render(
      <PresentationBlock
        payload={{
          config: { layout: "card" },
          output: {
            items: [
              { title: "첫째", description: "설명1", buttons: [{ id: "p1", label: "선택", type: "port" }] },
              { title: "둘째", description: "설명2" },
            ],
          },
        }}
        onButton={onButton}
      />,
    );
    expect(screen.getByTestId("wc-carousel")).toBeInTheDocument();
    expect(screen.getByText("첫째")).toBeInTheDocument();
    expect(screen.getByText("1 / 2")).toBeInTheDocument();
    fireEvent.click(screen.getByText("선택"));
    expect(onButton).toHaveBeenCalledWith("p1");
    // 다음 슬라이드
    fireEvent.click(screen.getByLabelText("다음"));
    expect(screen.getByText("둘째")).toBeInTheDocument();
  });

  it("table — 헤더/셀 렌더", () => {
    render(
      <PresentationBlock
        payload={{
          output: {
            columns: [
              { field: "name", label: "이름" },
              { field: "age", label: "나이" },
            ],
            rows: [{ name: "Kim", age: 30 }],
          },
        }}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByTestId("wc-table")).toBeInTheDocument();
    expect(screen.getByText("이름")).toBeInTheDocument();
    expect(screen.getByText("Kim")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
  });

  it("chart — bar SVG 렌더", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "bar", title: "매출" },
          output: { data: [{ x: "1월", y: 10 }, { x: "2월", y: 20 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    expect(chart).toHaveAttribute("data-chart-type", "bar");
    expect(screen.getByText("매출")).toBeInTheDocument();
    expect(chart.querySelectorAll("rect").length).toBe(2);
  });

  it("chart — pie 슬라이스 렌더", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "pie" },
          output: { data: [{ x: "a", y: 1 }, { x: "b", y: 3 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    expect(chart.querySelectorAll("path").length).toBe(2);
  });

  it("template — rendered 텍스트(태그 미해석, XSS 방어)", () => {
    render(
      <PresentationBlock
        payload={{ config: { outputFormat: "html" }, output: { rendered: "<b>굵게</b>" } }}
        onButton={vi.fn()}
      />,
    );
    const tpl = screen.getByTestId("wc-template");
    // 태그가 텍스트로 노출(해석되지 않음) — XSS 방어.
    expect(tpl.textContent).toContain("<b>굵게</b>");
    expect(tpl.querySelector("b")).toBeNull();
  });

  it("link 버튼 — anchor(target _blank)", () => {
    render(
      <PresentationBlock
        payload={{
          config: { layout: "card", buttons: [{ id: "l1", label: "방문", type: "link", url: "https://x.test" }] },
          output: { items: [{ title: "T" }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const link = screen.getByText("방문") as HTMLAnchorElement;
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("href")).toBe("https://x.test");
    expect(link.getAttribute("target")).toBe("_blank");
  });

  it("모르는 shape → 렌더 skip(null)", () => {
    const { container } = render(
      <PresentationBlock payload={{ config: {}, output: {} }} onButton={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });
});

describe("PresentationList", () => {
  it("복수 presentation 렌더", () => {
    render(
      <PresentationList
        presentations={[
          { output: { rendered: "T1" }, config: { outputFormat: "text" } },
          { output: { rows: [{ a: 1 }], columns: [{ field: "a", label: "A" }] } },
        ]}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByTestId("wc-template")).toBeInTheDocument();
    expect(screen.getByTestId("wc-table")).toBeInTheDocument();
  });

  it("빈 배열 → null", () => {
    const { container } = render(<PresentationList presentations={[]} onButton={vi.fn()} />);
    expect(container.firstChild).toBeNull();
  });
});
