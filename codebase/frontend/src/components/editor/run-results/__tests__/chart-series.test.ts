import { describe, it, expect } from "vitest";
import {
  DEFAULT_CHART_COLORS,
  chartColorAt,
  resolveChartColors,
  toChartSeriesModel,
} from "../renderers/chart-series";

describe("toChartSeriesModel (CLE-NODE-CHART 시리즈와 색)", () => {
  it("series 가 하나도 없으면 포인트를 그대로 단일 시리즈로 둔다", () => {
    const points = [
      { x: "Jan", y: 1 },
      { x: "Feb", y: 2 },
    ];
    const model = toChartSeriesModel(points);
    expect(model.series).toEqual([]);
    expect(model.rows).toBe(points);
  });

  it("X 와 시리즈를 처음 나온 순서로 펼치고 순번 키를 쓴다", () => {
    const model = toChartSeriesModel([
      { x: "Jan", y: 1200, series: "Seoul" },
      { x: "Jan", y: 800, series: "Busan" },
      { x: "Feb", y: 1500, series: "Seoul" },
      { x: "Mar", y: 700, series: "Busan" },
    ]);
    expect(model.series).toEqual([
      { key: "s0", name: "Seoul" },
      { key: "s1", name: "Busan" },
    ]);
    expect(model.rows).toEqual([
      { x: "Jan", s0: 1200, s1: 800 },
      { x: "Feb", s0: 1500 },
      { x: "Mar", s1: 700 },
    ]);
  });

  it("시리즈 이름이 x · y · 빈 문자열이어도 행 값과 섞이지 않는다", () => {
    const model = toChartSeriesModel([
      { x: "A", y: 1, series: "x" },
      { x: "A", y: 2, series: "y" },
      { x: "A", y: 3, series: "" },
    ]);
    expect(model.series.map((s) => s.name)).toEqual(["x", "y", ""]);
    expect(model.rows).toEqual([{ x: "A", s0: 1, s1: 2, s2: 3 }]);
  });

  it("같은 (series, X) 가 여러 번 나오면 마지막 값을 쓴다", () => {
    const model = toChartSeriesModel([
      { x: "Jan", y: 1, series: "S" },
      { x: "Jan", y: 5, series: "S" },
    ]);
    expect(model.rows).toEqual([{ x: "Jan", s0: 5 }]);
  });

  it("series 가 일부에만 있으면 없는 포인트를 빈 문자열 시리즈로 묶는다", () => {
    const model = toChartSeriesModel([
      { x: "Jan", y: 1, series: "S" },
      { x: "Jan", y: 2 },
    ]);
    expect(model.series).toEqual([
      { key: "s0", name: "S" },
      { key: "s1", name: "" },
    ]);
  });

  it("문자열이 아닌 series 는 문자열로 바꿔 같은 이름과 묶는다", () => {
    const model = toChartSeriesModel([
      { x: "Jan", y: 1, series: 1 },
      { x: "Feb", y: 2, series: "1" },
    ]);
    expect(model.series).toEqual([{ key: "s0", name: "1" }]);
  });
});

describe("resolveChartColors · chartColorAt (REQ-CHART-020)", () => {
  it("colors 가 있으면 그 배열을 쓴다", () => {
    expect(resolveChartColors(["#111", "#222"])).toEqual(["#111", "#222"]);
  });

  it.each([[undefined], [null], [[]], ["#111"], [[1, ""]]])(
    "colors 가 없거나 비면 기본 팔레트를 쓴다 (%j)",
    (colors) => {
      expect(resolveChartColors(colors)).toBe(DEFAULT_CHART_COLORS);
    },
  );

  it("i 번째 색은 colors[i % n] 이다", () => {
    const colors = ["#111", "#222"];
    expect([0, 1, 2, 3].map((i) => chartColorAt(colors, i))).toEqual([
      "#111",
      "#222",
      "#111",
      "#222",
    ]);
  });
});
