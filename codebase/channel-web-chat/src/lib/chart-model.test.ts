import { describe, it, expect } from "vitest";
import { toChart } from "./presentation";
import { toCartesianModel, valueRange, type CartesianModel } from "./chart-model";
import { chartSeriesCases, type ChartRenderShape } from "@/test-support/chart-fixtures";

/** 모델을 공유 픽스처의 `render` 모양으로 바꾼다. */
function renderShapeOf(model: CartesianModel): ChartRenderShape {
  const values = model.series.map((s) => {
    const row: Array<number | null> = model.labels.map(() => null);
    for (const { xi, v } of s.entries) row[xi] = v;
    return row;
  });
  return {
    x: model.labels,
    series: model.multi ? model.series.map((s) => s.name) : [],
    values,
  };
}

describe("toCartesianModel — 공유 시리즈 사례 (CLE-NODE-CHART 시리즈와 색)", () => {
  it("사례를 읽었다 (vacuous 방지)", () => {
    expect(chartSeriesCases.length).toBeGreaterThanOrEqual(8);
  });

  it.each(chartSeriesCases.map((c) => [c.name, c] as const))("%s", (_name, c) => {
    // 위젯은 페이로드를 toChart 로 정규화(series 를 문자열로)한 뒤 모델을 만든다.
    const { points } = toChart({ config: { chartType: "bar" }, output: { data: c.points } });
    expect(renderShapeOf(toCartesianModel(points))).toEqual(c.render);
  });
});

describe("toCartesianModel — 위젯 표시 규칙", () => {
  it("X 라벨은 표시 문자열로 바꾼다", () => {
    const { points } = toChart({
      output: { data: [{ x: 3, y: 1 }, { x: null, y: 2 }, { x: { a: 1 }, y: 3 }] },
    });
    expect(toCartesianModel(points).labels).toEqual(["3", "", '{"a":1}']);
  });

  it("숫자로 읽을 수 없는 y 는 0 으로 둔다", () => {
    const { points } = toChart({ output: { data: [{ x: "a", y: "12" }, { x: "b", y: "n/a" }] } });
    expect(toCartesianModel(points).series[0].entries).toEqual([
      { xi: 0, v: 12 },
      { xi: 1, v: 0 },
    ]);
  });
});

describe("valueRange", () => {
  it("0 과 1 을 늘 포함한다", () => {
    expect(valueRange([{ name: "", entries: [{ xi: 0, v: 0.5 }] }])).toEqual({ min: 0, max: 1 });
    expect(valueRange([{ name: "", entries: [{ xi: 0, v: -3 }, { xi: 1, v: 7 }] }])).toEqual({
      min: -3,
      max: 7,
    });
  });
});
