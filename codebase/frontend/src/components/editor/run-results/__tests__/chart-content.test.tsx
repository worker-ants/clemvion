import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ChartContent } from "../renderers/presentation-renderers";
import { EDITOR_DEFAULT_CHART_COLORS } from "../renderers/chart-series";

// recharts 는 jsdom 에서 크기를 재지 못해 아무것도 그리지 않는다. 차트 요소를 props 를
// 드러내는 div 로 바꿔 ChartContent 가 넘기는 dataKey · 이름 · 색을 확인한다.
vi.mock("recharts", () => {
  const Container = ({
    children,
    data,
  }: {
    children?: React.ReactNode;
    data?: unknown;
  }) => (
    <div data-testid="chart" data-rows={JSON.stringify(data ?? null)}>
      {children}
    </div>
  );
  const Mark = (kind: string) => {
    const MockMark = (props: {
      dataKey?: string;
      name?: string;
      fill?: string;
      stroke?: string;
    }) => (
      <div
        data-testid={kind}
        data-key={props.dataKey}
        data-name={props.name ?? ""}
        data-color={props.fill ?? props.stroke}
      />
    );
    return MockMark;
  };
  return {
    ResponsiveContainer: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
    BarChart: Container,
    LineChart: Container,
    AreaChart: Container,
    PieChart: Container,
    Bar: Mark("bar"),
    Line: Mark("line"),
    Area: Mark("area"),
    Pie: ({ children }: { children?: React.ReactNode }) => <div data-testid="pie">{children}</div>,
    Cell: ({ fill }: { fill?: string }) => <div data-testid="cell" data-color={fill} />,
    Legend: () => <div data-testid="legend" />,
    CartesianGrid: () => null,
    XAxis: () => null,
    YAxis: () => null,
    Tooltip: () => null,
  };
});

const multiSeries = [
  { x: "Jan", y: 1200, series: "Seoul" },
  { x: "Jan", y: 800, series: "Busan" },
  { x: "Feb", y: 1500, series: "Seoul" },
];

function marks(kind: string) {
  return screen.queryAllByTestId(kind).map((el) => ({
    key: el.getAttribute("data-key"),
    name: el.getAttribute("data-name"),
    color: el.getAttribute("data-color"),
  }));
}

describe("ChartContent 시리즈와 색 (CLE-NODE-CHART · REQ-CHART-020)", () => {
  it("단일 시리즈 bar 는 y 하나를 colors[0] 으로 칠하고 범례를 그리지 않는다", () => {
    render(
      <ChartContent
        data={{ data: [{ x: "A", y: 1 }, { x: "B", y: 2 }] }}
        config={{ chartType: "bar", colors: ["#111111", "#222222"] }}
      />,
    );
    expect(marks("bar")).toEqual([{ key: "y", name: "", color: "#111111" }]);
    expect(screen.queryByTestId("legend")).toBeNull();
  });

  it.each(["bar", "line", "area"])(
    "%s 다중 시리즈는 시리즈마다 순번 키 · 이름 · colors[i % n] 로 그리고 범례를 둔다",
    (chartType) => {
      render(
        <ChartContent
          data={{ data: multiSeries }}
          config={{ chartType, colors: ["#111111"] }}
        />,
      );
      expect(marks(chartType)).toEqual([
        { key: "s0", name: "Seoul", color: "#111111" },
        { key: "s1", name: "Busan", color: "#111111" },
      ]);
      expect(screen.getByTestId("legend")).toBeDefined();
      expect(JSON.parse(screen.getByTestId("chart").getAttribute("data-rows")!)).toEqual([
        { x: "Jan", s0: 1200, s1: 800 },
        { x: "Feb", s0: 1500 },
      ]);
    },
  );

  it("colors 가 없으면 기본 팔레트를 같은 규칙으로 쓴다", () => {
    render(<ChartContent data={{ data: multiSeries }} config={{ chartType: "line" }} />);
    expect(marks("line").map((m) => m.color)).toEqual([
      EDITOR_DEFAULT_CHART_COLORS[0],
      EDITOR_DEFAULT_CHART_COLORS[1],
    ]);
  });

  it("빈 문자열 시리즈는 범례에 화면 문구로 보여 준다", () => {
    render(
      <ChartContent
        data={{ data: [{ x: "A", y: 1, series: "" }, { x: "A", y: 2, series: "S" }] }}
        config={{ chartType: "bar" }}
      />,
    );
    expect(marks("bar").map((m) => m.name)).toEqual(["(빈 값)", "S"]);
  });

  it.each(["pie", "donut"])("%s 는 조각마다 colors[i % n] 을 쓴다", (chartType) => {
    render(
      <ChartContent
        data={{ data: [{ x: "A", y: 1 }, { x: "B", y: 2 }, { x: "C", y: 3 }] }}
        config={{ chartType, colors: ["#111111", "#222222"] }}
      />,
    );
    expect(
      screen.getAllByTestId("cell").map((el) => el.getAttribute("data-color")),
    ).toEqual(["#111111", "#222222", "#111111"]);
  });
  it("data 에 객체가 아닌 항목이 섞여도 건너뛰고 나머지를 그린다", () => {
    const mixed = [null, multiSeries[0], 7, "x", multiSeries[1], undefined, [1], multiSeries[2]];
    expect(() =>
      render(
        <ChartContent
          data={{ data: mixed }}
          config={{ chartType: "bar", colors: ["#111111", "#222222"] }}
        />,
      ),
    ).not.toThrow();
    expect(marks("bar").map((m) => m.name)).toEqual(["Seoul", "Busan"]);
    expect(JSON.parse(screen.getByTestId("chart").getAttribute("data-rows")!)).toEqual([
      { x: "Jan", s0: 1200, s1: 800 },
      { x: "Feb", s0: 1500 },
    ]);
  });

  it("단일 시리즈에서도 객체가 아닌 항목은 행에서 뺀다", () => {
    render(
      <ChartContent
        data={{ data: [null, { x: "A", y: 1 }, undefined, { x: "B", y: 2 }] }}
        config={{ chartType: "line" }}
      />,
    );
    expect(JSON.parse(screen.getByTestId("chart").getAttribute("data-rows")!)).toEqual([
      { x: "A", y: 1 },
      { x: "B", y: 2 },
    ]);
  });

  it("data 가 모두 객체가 아니면 차트 대신 원본 JSON 을 보여 준다", () => {
    render(<ChartContent data={{ data: [null, 3] }} config={{ chartType: "bar" }} />);
    expect(screen.queryByTestId("chart")).toBeNull();
  });
});
