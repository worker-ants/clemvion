import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, it, expect } from "vitest";
import {
  EDITOR_DEFAULT_CHART_COLORS,
  chartColorAt,
  chartPointsOf,
  resolveChartColors,
  toChartSeriesModel,
} from "../renderers/chart-series";

/**
 * 색 허용 규칙과 시리즈 묶음 규칙의 기대값은 세 스택이 함께 읽는 공유 픽스처
 * `codebase/shared-fixtures/chart/` 에 있다. 웹채팅 위젯 · 백엔드 핸들러 테스트도 같은 파일을 읽어서
 * 한쪽 규칙만 바뀌면 그쪽 테스트가 실패한다.
 */
const FIXTURE_DIR = path.resolve(__dirname, "../../../../../../shared-fixtures/chart");

interface ColorCorpus {
  maxLength: number;
  accepted: string[];
  trimmed: Array<[string, string]>;
  rejected: unknown[];
}

interface SeriesCase {
  name: string;
  points: Array<Record<string, unknown>>;
  render: { x: unknown[]; series: string[]; values: Array<Array<number | null>> };
}

function readFixture<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8")) as T;
}

const colorCorpus = readFixture<ColorCorpus>("colors.json");
const seriesCases = readFixture<{ cases: SeriesCase[] }>("series.json").cases;

/** 모델을 픽스처 `render` 모양(X 순서 · 시리즈 이름 · 시리즈 × X 값)으로 바꾼다. */
function renderShapeOf(points: Array<Record<string, unknown>>): SeriesCase["render"] {
  const model = toChartSeriesModel(points);
  if (model.series.length === 0) {
    return {
      x: model.rows.map((r) => r.x),
      series: [],
      values: [model.rows.map((r) => r.y as number)],
    };
  }
  return {
    x: model.rows.map((r) => r.x),
    series: model.series.map((s) => s.name),
    values: model.series.map((s) =>
      model.rows.map((r) => (s.key in r ? (r[s.key] as number) : null)),
    ),
  };
}

describe("공유 픽스처를 읽는다 (vacuous 방지)", () => {
  it("색 코퍼스와 시리즈 사례가 비어 있지 않다", () => {
    expect(colorCorpus.accepted.length).toBeGreaterThan(10);
    expect(colorCorpus.rejected.length).toBeGreaterThan(10);
    expect(colorCorpus.trimmed.length).toBeGreaterThan(0);
    expect(seriesCases.length).toBeGreaterThanOrEqual(8);
  });
});

describe("toChartSeriesModel — 공유 시리즈 사례 (CLE-NODE-CHART 시리즈와 색)", () => {
  it.each(seriesCases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    expect(renderShapeOf(c.points)).toEqual(c.render);
  });
});

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

  // 마지막 값 · 일부만 있는 series · 문자열이 아닌 series 는 공유 시리즈 사례가 덮는다.
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

  it("기본 팔레트는 바꿀 수 없다", () => {
    expect(Object.isFrozen(EDITOR_DEFAULT_CHART_COLORS)).toBe(true);
  });

  it.each(colorCorpus.accepted)("공유 코퍼스의 허용 색은 그대로 쓴다 (%s)", (color) => {
    expect(resolveChartColors([color])).toEqual([color]);
  });

  it.each(colorCorpus.trimmed)("앞뒤 공백은 지우고 쓴다 (%j)", (input, color) => {
    expect(resolveChartColors([input])).toEqual([color]);
  });

  it.each(colorCorpus.rejected.map((v) => [JSON.stringify(v), v] as const))(
    "공유 코퍼스의 허용 밖 값은 버리고 남은 색이 없으면 기본 팔레트를 쓴다 (%s)",
    (_label, value) => {
      expect(resolveChartColors([value])).toBe(EDITOR_DEFAULT_CHART_COLORS);
    },
  );

  it("코퍼스의 길이 경계가 maxLength 와 맞물린다", () => {
    const lengths = colorCorpus.accepted.map((c) => c.length);
    expect(Math.max(...lengths)).toBe(colorCorpus.maxLength);
    const tooLong = colorCorpus.rejected.filter(
      (v): v is string => typeof v === "string" && v.length === colorCorpus.maxLength + 1,
    );
    expect(tooLong.length).toBeGreaterThan(0);
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
