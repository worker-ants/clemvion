import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PresentationBlock, PresentationList } from "./presentations";
import { payloadOf } from "@/test-support/presentation-fixtures";

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

  it("carousel — 잘림 배너 총 개수 노출", () => {
    render(
      <PresentationBlock
        payload={{
          output: { items: [{ title: "A" }], itemsTruncated: true, itemsTotalCount: 9 },
        }}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByText("총 9개 중 일부만 표시돼요.")).toBeInTheDocument();
  });

  it("carousel — 잘림 배너 무개수 폴백 + 비잘림이면 배너 없음", () => {
    const { unmount } = render(
      <PresentationBlock
        payload={{ output: { items: [{ title: "A" }], itemsTruncated: true } }}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByText("일부 항목만 표시돼요.")).toBeInTheDocument();
    unmount();
    render(
      <PresentationBlock payload={{ output: { items: [{ title: "A" }] } }} onButton={vi.fn()} />,
    );
    expect(screen.queryByText("일부 항목만 표시돼요.")).not.toBeInTheDocument();
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
    // I5: non-conditional assertions — XSS attributes must be removed regardless of tag survival
    // img src=x may survive sanitize, but onerror must be stripped
    const img = tpl.querySelector("img");
    if (img) {
      expect(img.getAttribute("onerror")).toBeNull();
    }
    const a = tpl.querySelector("a");
    if (a) {
      expect((a.getAttribute("href") ?? "").startsWith("javascript:")).toBe(false);
    }
    // The script tag itself must be removed unconditionally
    expect(tpl.querySelector("script")).toBeNull();
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


describe("chart — line/area タイプ (I8)", () => {
  it("chart line — polyline + circle + tooltip", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "line" },
          output: { data: [{ x: "1월", y: 5 }, { x: "2월", y: 10 }, { x: "3월", y: 7 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    expect(chart).toHaveAttribute("data-chart-type", "line");
    expect(chart.querySelector("polyline")).not.toBeNull();
    expect(chart.querySelectorAll("circle").length).toBeGreaterThanOrEqual(3);
    const titles = Array.from(chart.querySelectorAll("title")).map((t) => t.textContent);
    expect(titles).toContain("1월: 5");
    expect(titles).toContain("3월: 7");
  });

  it("chart area — polygon(fill) + polyline + circle + tooltip", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "area" },
          output: { data: [{ x: "A", y: 3 }, { x: "B", y: 8 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    expect(chart).toHaveAttribute("data-chart-type", "area");
    expect(chart.querySelector("polygon")).not.toBeNull();
    expect(chart.querySelector("polyline")).not.toBeNull();
    const titles = Array.from(chart.querySelectorAll("title")).map((t) => t.textContent);
    expect(titles).toContain("A: 3");
    expect(titles).toContain("B: 8");
  });
});

describe("chart — donut (I9)", () => {
  it("donut — .wc-chart-pie-wrap 존재 + donut hole circle + aria-label", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "donut" },
          output: { data: [{ x: "a", y: 2 }, { x: "b", y: 3 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    expect(chart).toHaveAttribute("data-chart-type", "donut");
    const wrap = chart.querySelector(".wc-chart-pie-wrap");
    expect(wrap).not.toBeNull();
    // aria-label should reflect donut (i18n: Provider 없이 렌더 → 기본 ko, §4 chart aria-label 지역화)
    const svg = chart.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toBe("도넛 차트");
    // donut hole: a white circle with r proportional to slice radius
    const circles = Array.from(chart.querySelectorAll("circle"));
    // At least one circle with fill=#fff (donut hole) should exist
    const donutHole = circles.find((c) => c.getAttribute("fill") === "#fff");
    expect(donutHole).not.toBeUndefined();
  });
});

describe("template — FORBID_TAGS (I10)", () => {
  it("form/input/style 태그 제거", () => {
    render(
      <PresentationBlock
        payload={{
          config: { outputFormat: "html" },
          output: {
            rendered: '<form><input type="text" value="x"></form><style>*{display:none}</style><b>남음</b>',
          },
        }}
        onButton={vi.fn()}
      />,
    );
    const tpl = screen.getByTestId("wc-template");
    expect(tpl.querySelector("form")).toBeNull();
    expect(tpl.querySelector("input")).toBeNull();
    expect(tpl.querySelector("style")).toBeNull();
    expect(tpl.querySelector("b")?.textContent).toBe("남음");
  });
});

describe("template — truncLabel boundary (I7)", () => {
  it("chart x틱 — 긴 라벨은 잘라서 표시", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "bar" },
          output: { data: [{ x: "일이삼사오육칠팔구십", y: 5 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    // default max=7: "일이삼사오육칠팔구십" (10 chars) → "일이삼사오육…" (7 chars with ellipsis)
    const ticks = Array.from(chart.querySelectorAll("text.wc-chart-tick")).map(
      (t) => t.textContent,
    );
    const truncated = ticks.find((t) => t?.includes("…"));
    expect(truncated).toBeDefined();
    expect(truncated!.length).toBeLessThanOrEqual(7);
  });
});

describe("template — W2 empty safeHtml fallback", () => {
  it("sanitize 결과 빈 문자열 → plain text 폴백(data-rich 없음)", () => {
    // Script-only content gets fully stripped → empty string → plain text fallback
    render(
      <PresentationBlock
        payload={{
          config: { outputFormat: "html" },
          output: { rendered: "<script>alert(1)</script>" },
        }}
        onButton={vi.fn()}
      />,
    );
    const tpl = screen.getByTestId("wc-template");
    // safeHtml is empty → falls back to plain text div (no data-rich)
    // The plain text div shows the original rendered text
    expect(tpl.querySelector("[data-rich]")).toBeNull();
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

// 새로고침 복원 경로 회귀 가드 — durable thread turn.presentations[] 는 PresentationPayload shape.
// spec/7-channel-web-chat/1-widget-app §2: 렌더러는 {config,output} 과 PresentationPayload 를 모두 수용.
describe("복원 thread presentation (PresentationPayload) 렌더", () => {
  it("carousel/table/chart/template 4종 모두 렌더", () => {
    render(
      <PresentationList
        presentations={[
          payloadOf("carousel", { layout: "card", items: [{ title: "상품A" }] }),
          payloadOf("table", { columns: [{ field: "n", label: "이름" }], rows: [{ n: "행1" }] }),
          payloadOf("chart", { chartType: "bar", data: [{ x: "A", y: 1 }] }),
          payloadOf("template", { content: "안내문", outputFormat: "text" }),
        ]}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByTestId("wc-carousel")).toBeInTheDocument();
    expect(screen.getByTestId("wc-table")).toBeInTheDocument();
    expect(screen.getByTestId("wc-chart")).toBeInTheDocument();
    expect(screen.getByTestId("wc-template")).toBeInTheDocument();
    // 내용까지 실제로 그려졌는지 — testid 만 보면 빈 렌더 회귀를 놓친다.
    expect(screen.getByText("상품A")).toBeInTheDocument();
    expect(screen.getByText("행1")).toBeInTheDocument();
    expect(screen.getByText("안내문")).toBeInTheDocument();
  });

  it("복원 carousel 의 port 버튼 클릭 → onButton 디스패치", () => {
    const onButton = vi.fn();
    render(
      <PresentationList
        presentations={[
          payloadOf("carousel", {
            layout: "card",
            items: [{ title: "상품A", buttons: [{ id: "btn_1", label: "담기", type: "port" }] }],
          }),
        ]}
        onButton={onButton}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "담기" }));
    expect(onButton).toHaveBeenCalledWith("btn_1");
  });

  // truncation 은 payload 바깥 top-level — 흡수하지 않으면 잘림 배너가 영영 안 뜬다(ai-agent §7.10 / 공통 §10.4).
  // §2/R8: rowsTotalCount 가 있으면 총 개수를 함께 노출(메인 편집기 parity).
  it("AI render_table 의 top-level truncation(+총 개수) → 총 개수 잘림 배너 노출", () => {
    render(
      <PresentationList
        presentations={[
          payloadOf(
            "table",
            { columns: [{ field: "n", label: "N" }], rows: [{ n: "a" }] },
            { rowsTruncated: true, rowsTotalCount: 2000 },
          ),
        ]}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByText("총 2000개 중 일부만 표시돼요.")).toBeInTheDocument();
  });

  it("AI render_carousel 의 top-level truncation(+총 개수) → 총 개수 잘림 배너 노출", () => {
    render(
      <PresentationList
        presentations={[
          payloadOf(
            "carousel",
            { layout: "card", items: [{ title: "상품A" }] },
            { itemsTruncated: true, itemsTotalCount: 30 },
          ),
        ]}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByText("총 30개 중 일부만 표시돼요.")).toBeInTheDocument();
  });

  it("AI render_carousel 의 truncation 만 있고 총 개수 부재 → 폴백 잘림 배너", () => {
    render(
      <PresentationList
        presentations={[
          payloadOf("carousel", { layout: "card", items: [{ title: "상품A" }] }, { itemsTruncated: true }),
        ]}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByText("일부 항목만 표시돼요.")).toBeInTheDocument();
  });

  // 잘림이지만 총 개수 부재 → 개수 없는 폴백 문구(해요체).
  it("truncation 만 있고 총 개수 부재 → 폴백 잘림 배너", () => {
    render(
      <PresentationList
        presentations={[
          payloadOf(
            "table",
            { columns: [{ field: "n", label: "N" }], rows: [{ n: "a" }] },
            { rowsTruncated: true },
          ),
        ]}
        onButton={vi.fn()}
      />,
    );
    expect(screen.getByText("일부 행만 표시돼요.")).toBeInTheDocument();
  });

  it("truncation 없으면 잘림 배너 미노출", () => {
    render(
      <PresentationList
        presentations={[payloadOf("table", { columns: [{ field: "n", label: "N" }], rows: [{ n: "a" }] })]}
        onButton={vi.fn()}
      />,
    );
    expect(screen.queryByText(/표시돼요\./)).not.toBeInTheDocument();
  });
});

describe("chart — 시리즈와 색 (CLE-NODE-CHART · REQ-CHART-020)", () => {
  const multi = [
    { x: "Jan", y: 1200, series: "Seoul" },
    { x: "Jan", y: 800, series: "Busan" },
    { x: "Feb", y: 1500, series: "Seoul" },
  ];
  const fills = (els: NodeListOf<Element>) => Array.from(els).map((el) => el.getAttribute("fill"));
  const titlesOf = (el: HTMLElement) =>
    Array.from(el.querySelectorAll("title")).map((t) => t.textContent);

  it("단일 시리즈 bar 는 모든 막대를 colors[0] 으로 칠하고 범례가 없다", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "bar", colors: ["#111111", "#222222"] },
          output: { data: [{ x: "a", y: 1 }, { x: "b", y: 2 }, { x: "c", y: 3 }] },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    expect(fills(chart.querySelectorAll("rect"))).toEqual(["#111111", "#111111", "#111111"]);
    expect(chart.querySelector(".wc-chart-legend")).toBeNull();
  });

  it("다중 시리즈 bar 는 시리즈마다 colors[i % n] · 범례 · 시리즈 툴팁을 쓴다", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "bar", colors: ["#111111", "#222222"] },
          output: { data: multi },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    // Feb 에는 Busan 포인트가 없어 막대가 3개다.
    expect(fills(chart.querySelectorAll("rect"))).toEqual(["#111111", "#111111", "#222222"]);
    const legend = chart.querySelector(".wc-chart-legend");
    expect(Array.from(legend!.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
      "Seoul",
      "Busan",
    ]);
    expect(titlesOf(chart)).toEqual(["Seoul · Jan: 1200", "Seoul · Feb: 1500", "Busan · Jan: 800"]);
    // X 카테고리는 처음 나온 순서로 한 번씩만 눈금을 그린다.
    const ticks = Array.from(chart.querySelectorAll("text.wc-chart-tick")).map((t) => t.textContent);
    expect(ticks.filter((t) => t === "Jan" || t === "Feb")).toEqual(["Jan", "Feb"]);
  });

  it.each(["line", "area"])("%s 다중 시리즈는 시리즈마다 선 하나를 다른 색으로 그린다", (chartType) => {
    render(
      <PresentationBlock
        payload={{ config: { chartType }, output: { data: multi } }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    const strokes = Array.from(chart.querySelectorAll("polyline")).map((el) =>
      el.getAttribute("stroke"),
    );
    expect(strokes).toHaveLength(2);
    expect(strokes[0]).not.toBe(strokes[1]);
  });

  it("같은 (series, X) 가 여러 번 나오면 마지막 값을 그린다", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "bar" },
          output: { data: [{ x: "Jan", y: 1, series: "S" }, { x: "Jan", y: 5, series: "S" }] },
        }}
        onButton={vi.fn()}
      />,
    );
    expect(titlesOf(screen.getByTestId("wc-chart"))).toEqual(["S · Jan: 5"]);
  });

  it("시리즈 이름이 x · y · 빈 문자열이어도 따로 그리고 빈 이름은 화면 문구로 보여 준다", () => {
    render(
      <PresentationBlock
        payload={{
          config: { chartType: "bar" },
          output: {
            data: [
              { x: "A", y: 1, series: "x" },
              { x: "A", y: 2, series: "y" },
              { x: "A", y: 3, series: "" },
            ],
          },
        }}
        onButton={vi.fn()}
      />,
    );
    const chart = screen.getByTestId("wc-chart");
    expect(chart.querySelectorAll("rect")).toHaveLength(3);
    const legend = chart.querySelector(".wc-chart-legend");
    expect(Array.from(legend!.querySelectorAll("li")).map((li) => li.textContent)).toEqual([
      "x",
      "y",
      "(빈 값)",
    ]);
  });
  describe("기하 · 색 순환", () => {
    // B 에는 Feb 포인트가 없다. 가로 눈금 간격은 (280 - 30 - 8) / 2 = 121 이다.
    const gap = [
      { x: "Jan", y: 10, series: "A" },
      { x: "Jan", y: 20, series: "B" },
      { x: "Feb", y: 30, series: "A" },
      { x: "Mar", y: 40, series: "A" },
      { x: "Mar", y: 50, series: "B" },
    ];
    const renderChart = (chartType: string, data: unknown[], colors?: string[]) => {
      render(
        <PresentationBlock
          payload={{ config: { chartType, ...(colors ? { colors } : {}) }, output: { data } }}
          onButton={vi.fn()}
        />,
      );
      return screen.getByTestId("wc-chart");
    };
    const pointsOf = (el: Element) =>
      (el.getAttribute("points") ?? "").split(" ").map((p) => p.split(",").map(Number));
    const num = (el: Element, attr: string) => Number(el.getAttribute(attr));

    it.each(["line", "area"])("%s 는 빠진 X 를 건너뛰고 시리즈마다 있는 점만 잇는다", (chartType) => {
      const chart = renderChart(chartType, gap);
      const lines = Array.from(chart.querySelectorAll("polyline")).map(pointsOf);
      expect(lines.map((pts) => pts.map(([x]) => x))).toEqual([
        [30, 151, 272],
        [30, 272],
      ]);
      // 점마다 원이 하나다.
      expect(chart.querySelectorAll("circle")).toHaveLength(5);
    });

    it("area 는 시리즈마다 다각형을 하나 그리고 시작 · 끝 x 를 그 시리즈의 첫 · 마지막 점에서 잡는다", () => {
      const chart = renderChart("area", gap);
      const polygons = Array.from(chart.querySelectorAll("polygon")).map(pointsOf);
      expect(polygons).toHaveLength(2);
      // 바닥은 mT + plotH = 148 이다. 다각형은 [바닥 시작, 선의 점들, 바닥 끝] 이다.
      const [a, b] = polygons;
      expect([a[0], a[a.length - 1]]).toEqual([[30, 148], [272, 148]]);
      expect([b[0], b[b.length - 1]]).toEqual([[30, 148], [272, 148]]);
      expect(a).toHaveLength(5);
      expect(b).toHaveLength(4);
    });

    it("line 은 점이 하나뿐인 시리즈도 선 하나로 그린다", () => {
      const chart = renderChart("line", [
        { x: "Jan", y: 1, series: "A" },
        { x: "Feb", y: 2, series: "A" },
        { x: "Feb", y: 3, series: "B" },
      ]);
      const lines = Array.from(chart.querySelectorAll("polyline")).map(pointsOf);
      expect(lines.map((pts) => pts.length)).toEqual([2, 1]);
      expect(chart.querySelector(".wc-chart-legend")!.querySelectorAll("li")).toHaveLength(2);
    });

    it("다중 시리즈 bar 는 같은 X 안에서 시리즈 막대를 옆으로 나란히 놓는다", () => {
      const chart = renderChart("bar", gap);
      const rects = Array.from(chart.querySelectorAll("rect"));
      // 막대는 A: Jan · Feb · Mar, B: Jan · Mar 순서다.
      expect(rects).toHaveLength(5);
      const [aJan, aFeb, aMar, bJan, bMar] = rects;
      const width = num(aJan, "width");
      expect(width).toBeGreaterThan(0);
      for (const r of rects) expect(num(r, "width")).toBeCloseTo(width, 6);
      // 같은 X 에서 B 는 A 바로 오른쪽에서 시작한다.
      expect(num(bJan, "x") - num(aJan, "x")).toBeCloseTo(width, 6);
      expect(num(bMar, "x") - num(aMar, "x")).toBeCloseTo(width, 6);
      // 다음 X 의 막대는 앞 X 의 두 막대 오른쪽에 있다.
      expect(num(aFeb, "x")).toBeGreaterThan(num(bJan, "x") + width);
      expect(num(aMar, "x")).toBeGreaterThan(num(aFeb, "x") + width);
    });

    it("시리즈가 colors 보다 많으면 색을 돌려 쓴다 (colors[i % n])", () => {
      const three = [
        { x: "Jan", y: 1, series: "A" },
        { x: "Jan", y: 2, series: "B" },
        { x: "Jan", y: 3, series: "C" },
      ];
      const bar = renderChart("bar", three, ["red", "blue"]);
      expect(fills(bar.querySelectorAll("rect"))).toEqual(["red", "blue", "red"]);
      const swatches = Array.from(bar.querySelectorAll(".wc-legend-swatch")).map(
        (el) => (el as HTMLElement).style.background,
      );
      expect(swatches).toEqual(["red", "blue", "red"]);
    });

    it("line 도 시리즈가 colors 보다 많으면 선 색을 돌려 쓴다", () => {
      const chart = renderChart(
        "line",
        [
          { x: "Jan", y: 1, series: "A" },
          { x: "Jan", y: 2, series: "B" },
          { x: "Jan", y: 3, series: "C" },
        ],
        ["red", "blue"],
      );
      const strokes = Array.from(chart.querySelectorAll("polyline")).map((el) =>
        el.getAttribute("stroke"),
      );
      expect(strokes).toEqual(["red", "blue", "red"]);
    });

    it("colors 가 없으면 기본 팔레트를 처음부터 쓴다", () => {
      const single = renderChart("bar", [{ x: "a", y: 1 }, { x: "b", y: 2 }]);
      expect(fills(single.querySelectorAll("rect"))).toEqual(["#5B4FE9", "#5B4FE9"]);
    });

    it("colors 가 없는 다중 시리즈는 기본 팔레트의 [0] · [1] 을 쓴다", () => {
      const chart = renderChart("bar", gap);
      const colors = Array.from(new Set(fills(chart.querySelectorAll("rect"))));
      expect(colors).toEqual(["#5B4FE9", "#22B8CF"]);
    });
  });
});
