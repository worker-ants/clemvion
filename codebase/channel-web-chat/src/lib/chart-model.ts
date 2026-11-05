// 차트 포인트를 SVG 렌더러가 그릴 모양으로 바꾸는 순수 함수. DOM 을 쓰지 않는다.
// 규칙은 CLE-NODE-CHART 「시리즈와 색」이고 에디터의 toChartSeriesModel 과 같다. 두 구현이 같은지는
// 공유 픽스처 codebase/shared-fixtures/chart/series.json 을 두 테스트가 함께 읽어 확인한다.
import { cellText, type ChartData } from "./presentation";

type ChartPoints = ChartData["points"];

/** 숫자 y 는 그대로, 문자열은 숫자로 읽고, 읽을 수 없으면 0 이다. */
export function numericValue(y: ChartPoints[number]["y"]): number {
  return typeof y === "number" ? y : Number(y) || 0;
}

/** pie · donut 조각. 포인트마다 라벨 하나와 값 하나다. */
export function numericPoints(data: ChartPoints): Array<{ label: string; value: number }> {
  return data.map((d) => ({ label: cellText(d.x), value: numericValue(d.y) }));
}

export interface CartesianEntry {
  /** labels 안의 X 순번. */
  xi: number;
  v: number;
}

export interface CartesianSeries {
  /** 시리즈 이름. 단일 시리즈면 빈 문자열이고 범례를 그리지 않는다. */
  name: string;
  /** 값이 있는 X 만 xi 오름차순으로 담는다. 포인트가 없는 X 는 항목이 없다(O(포인트 수)). */
  entries: CartesianEntry[];
}

export interface CartesianModel {
  labels: string[];
  series: CartesianSeries[];
  /** 포인트에 series 가 하나라도 있으면 true(범례를 그린다). */
  multi: boolean;
}

/**
 * bar · line · area 의 X 카테고리와 시리즈(CLE-NODE-CHART 「시리즈와 색」). series 가 하나도
 * 없으면 포인트마다 카테고리 하나인 단일 시리즈다. series 가 있으면 X 와 시리즈를 처음 나온
 * 순서로 모으고, 같은 (series, X) 는 마지막 값을 쓴다. 시리즈 이름은 키로 쓰지 않고 순번으로 둔다.
 */
export function toCartesianModel(data: ChartPoints): CartesianModel {
  if (!data.some((d) => d.series !== undefined)) {
    return {
      labels: data.map((d) => cellText(d.x)),
      series: [{ name: "", entries: data.map((d, xi) => ({ xi, v: numericValue(d.y) })) }],
      multi: false,
    };
  }
  const labels: string[] = [];
  const xIndex = new Map<unknown, number>();
  const named: Array<{ name: string; byX: Map<number, number> }> = [];
  const seriesIndex = new Map<string, number>();
  for (const d of data) {
    let xi = xIndex.get(d.x);
    if (xi === undefined) {
      xi = labels.length;
      xIndex.set(d.x, xi);
      labels.push(cellText(d.x));
    }
    const name = d.series ?? "";
    let si = seriesIndex.get(name);
    if (si === undefined) {
      si = named.length;
      seriesIndex.set(name, si);
      named.push({ name, byX: new Map() });
    }
    named[si].byX.set(xi, numericValue(d.y));
  }
  return {
    labels,
    series: named.map(({ name, byX }) => ({
      name,
      entries: Array.from(byX, ([xi, v]) => ({ xi, v })).sort((a, b) => a.xi - b.xi),
    })),
    multi: true,
  };
}

/** 값이 있는 항목의 최솟값 · 최댓값. 0 과 1 을 늘 포함한다. */
export function valueRange(series: CartesianSeries[]): { min: number; max: number } {
  let min = 0;
  let max = 1;
  for (const s of series) {
    for (const { v } of s.entries) {
      if (v > max) max = v;
      if (v < min) min = v;
    }
  }
  return { min, max };
}
