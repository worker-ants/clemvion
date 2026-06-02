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

  it("chart bar — 축 레이블 + 값 툴팁(<title>) + x틱", () => {
    render(
      <PresentationBlock
        payload={{
          config: {
            chartType: "bar",
            xAxis: { field: "m", label: "월" },
            yAxis: { field: "v", label: "매출액" },
          },
          output: { data: [{ x: "1월", y: 10 }, { x: "2월", y: 20 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    // 축 레이블
    expect(chart.textContent).toContain("월");
    expect(chart.textContent).toContain("매출액");
    // 값 툴팁
    const titles = Array.from(chart.querySelectorAll("title")).map((t) => t.textContent);
    expect(titles).toContain("1월: 10");
    expect(titles).toContain("2월: 20");
  });

  it("chart — pie 슬라이스 + 범례", () => {
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
    // 범례 — 카테고리·값
    const legend = chart.querySelector(".wc-chart-legend");
    expect(legend).not.toBeNull();
    expect(legend?.textContent).toContain("a");
    expect(legend?.textContent).toContain("3");
    // 슬라이스 툴팁
    expect(Array.from(chart.querySelectorAll("title")).map((t) => t.textContent)).toContain("b: 3");
  });

  it("template html — 안전 태그는 풍부 렌더(sanitize)", () => {
    render(
      <PresentationBlock
        payload={{ config: { outputFormat: "html" }, output: { rendered: "<b>굵게</b> 텍스트" } }}
        onButton={vi.fn()}
      />,
    );
    const tpl = screen.getByTestId("wc-template");
    // 안전한 <b> 는 실제 요소로 렌더(해석됨).
    expect(tpl.querySelector("b")?.textContent).toBe("굵게");
    expect(tpl.querySelector("[data-rich]")).not.toBeNull();
  });

  it("template html — 위험 콘텐츠(script/onerror/javascript:) 제거(XSS 방어)", () => {
    render(
      <PresentationBlock
        payload={{
          config: { outputFormat: "html" },
          output: {
            rendered:
              '<p>안전</p><script>alert(1)</script><img src=x onerror="alert(2)"><a href="javascript:alert(3)">링크</a>',
          },
        }}
        onButton={vi.fn()}
      />,
    );
    const tpl = screen.getByTestId("wc-template");
    expect(tpl.querySelector("script")).toBeNull();
    const img = tpl.querySelector("img");
    if (img) expect(img.getAttribute("onerror")).toBeNull();
    const a = tpl.querySelector("a");
    if (a) expect((a.getAttribute("href") ?? "").startsWith("javascript:")).toBe(false);
    expect(tpl.textContent).toContain("안전");
  });

  it("template markdown — marked 로 변환 후 렌더", () => {
    render(
      <PresentationBlock
        payload={{
          config: { outputFormat: "markdown" },
          output: { rendered: "# 제목\n\n**굵게** 와 [링크](https://x.test)" },
        }}
        onButton={vi.fn()}
      />,
    );
    const tpl = screen.getByTestId("wc-template");
    expect(tpl.querySelector("h1")?.textContent).toContain("제목");
    expect(tpl.querySelector("strong")?.textContent).toBe("굵게");
    const a = tpl.querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://x.test");
    expect(a?.getAttribute("target")).toBe("_blank"); // 링크 새 탭 강제
  });

  it("template text — 태그 미해석(plain text)", () => {
    render(
      <PresentationBlock
        payload={{ config: { outputFormat: "text" }, output: { rendered: "<b>굵게</b>" } }}
        onButton={vi.fn()}
      />,
    );
    const tpl = screen.getByTestId("wc-template");
    expect(tpl.textContent).toContain("<b>굵게</b>");
    expect(tpl.querySelector("b")).toBeNull();
    expect(tpl.querySelector("[data-rich]")).toBeNull();
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
