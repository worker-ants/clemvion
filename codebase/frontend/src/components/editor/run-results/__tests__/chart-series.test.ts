import { describe, it, expect } from "vitest";
import {
  EDITOR_DEFAULT_CHART_COLORS,
  chartColorAt,
  chartPointsOf,
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

describe("객체가 아닌 포인트 방어", () => {
  it("chartPointsOf 는 객체가 아닌 항목을 뺀다", () => {
    expect(chartPointsOf([null, { x: 1 }, 3, "s", undefined, [1], { x: 2 }])).toEqual([
      { x: 1 },
      { x: 2 },
    ]);
    expect(chartPointsOf("nope")).toEqual([]);
    expect(chartPointsOf(undefined)).toEqual([]);
  });

  it("chartPointsOf 는 모두 객체면 받은 배열을 그대로 돌려준다", () => {
    const points = [{ x: 1 }, { x: 2 }];
    expect(chartPointsOf(points)).toBe(points);
  });

  it("toChartSeriesModel 은 null 이 섞여도 던지지 않고 건너뛴다", () => {
    const points = [
      null,
      { x: "Jan", y: 1, series: "S" },
      7,
      { x: "Feb", y: 2, series: "S" },
    ] as unknown as Array<Record<string, unknown>>;
    const model = toChartSeriesModel(points);
    expect(model.series).toEqual([{ key: "s0", name: "S" }]);
    expect(model.rows).toEqual([
      { x: "Jan", s0: 1 },
      { x: "Feb", s0: 2 },
    ]);
  });

  it("series 가 없는 포인트 사이의 null 도 단일 시리즈로 처리한다", () => {
    const points = [{ x: "A", y: 1 }, null, { x: "B", y: 2 }] as unknown as Array<
      Record<string, unknown>
    >;
    const model = toChartSeriesModel(points);
    expect(model.series).toEqual([]);
    expect(model.rows).toEqual([
      { x: "A", y: 1 },
      { x: "B", y: 2 },
    ]);
  });
});

describe("resolveChartColors · chartColorAt (REQ-CHART-020)", () => {
  it("colors 가 있으면 그 배열을 쓴다", () => {
    expect(resolveChartColors(["#111", "#222"])).toEqual(["#111", "#222"]);
  });

  it.each([[undefined], [null], [[]], ["#111"], [[1, ""]]])(
    "colors 가 없거나 비면 기본 팔레트를 쓴다 (%j)",
    (colors) => {
      expect(resolveChartColors(colors)).toBe(EDITOR_DEFAULT_CHART_COLORS);
    },
  );

  it.each([
    "#fff",
    "#ffff",
    "#ffffff",
    "#ffffffaa",
    "#ABCDEF",
    "rgb(1, 2, 3)",
    "rgba(1,2,3,.5)",
    "hsl(120 50% 50% / 0.5)",
    "hsla(120, 50%, 50%, 0.5)",
    "red",
    "RebeccaPurple",
  ])("허용 형식의 색은 그대로 쓴다 (%s)", (color) => {
    expect(resolveChartColors([color])).toEqual([color]);
  });

  it("앞뒤 공백은 지우고 쓴다", () => {
    expect(resolveChartColors(["  #111  ", "\tblue\n"])).toEqual(["#111", "blue"]);
  });

  it.each([
    "url(https://attacker.example/p?d=1)",
    "URL( 'https://attacker.example/p' )",
    "red;background:url(x)",
    "red} body{display:none",
    "var(--brand)",
    "expression(alert(1))",
    "rgb(url(x))",
    "rgb(1, 2, 3",
    "#12",
    "#12345",
    "#gggggg",
    "not a color",
    "   ",
    `#${"a".repeat(70)}`,
    `rgb(${"1,".repeat(40)})`,
  ])("허용 밖의 값은 버리고 남은 색이 없으면 기본 팔레트를 쓴다 (%s)", (color) => {
    expect(resolveChartColors([color])).toBe(EDITOR_DEFAULT_CHART_COLORS);
  });

  it("허용 밖의 값만 걸러 내고 나머지 순서는 지킨다", () => {
    expect(resolveChartColors(["url(x)", "#111", 3, "", "blue"])).toEqual(["#111", "blue"]);
  });

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
