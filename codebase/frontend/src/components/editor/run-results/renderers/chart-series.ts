/**
 * Chart 노드 `output.data`(`{ x, y?, series? }[]`)를 recharts 가 그릴 모양으로 펼친다.
 * 규칙은 CLE-NODE-CHART 「시리즈와 색」 · REQ-CHART-020 이다. `render_chart` 페이로드도 같은
 * 규칙을 따른다.
 */

export const DEFAULT_CHART_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

export interface ChartSeries {
  /** recharts `dataKey`. 시리즈 이름이 `x` · `y` · 빈 문자열이어도 섞이지 않도록 순번으로 만든다. */
  key: string;
  /** 범례와 툴팁에 보여 줄 시리즈 이름. */
  name: string;
}

export interface ChartSeriesModel {
  /** recharts `data` 행. 다중 시리즈면 `{ x, s0, s1, … }`, 단일 시리즈면 받은 포인트 그대로다. */
  rows: Array<Record<string, unknown>>;
  /** 처음 나온 순서의 시리즈 목록. 포인트에 `series` 가 하나도 없으면 빈 배열(단일 시리즈)이다. */
  series: ChartSeries[];
}

/** `config.colors` 가 없거나 비면 기본 팔레트를 쓴다(REQ-CHART-004 · 020). */
export function resolveChartColors(colors: unknown): string[] {
  if (!Array.isArray(colors)) return DEFAULT_CHART_COLORS;
  const valid = colors.filter((c): c is string => typeof c === "string" && c !== "");
  return valid.length > 0 ? valid : DEFAULT_CHART_COLORS;
}

/** i 번째 시리즈 · 조각의 색. 색 배열을 돌려 쓴다. */
export function chartColorAt(colors: string[], index: number): string {
  return colors[index % colors.length];
}

function seriesNameOf(point: Record<string, unknown>): string | undefined {
  const value = point.series;
  return value === undefined || value === null ? undefined : String(value);
}

/**
 * 긴 형식 포인트 배열을 X 카테고리 행으로 펼친다. X 와 시리즈는 처음 나온 순서를 지키고,
 * 같은 (series, X) 가 여러 번 나오면 마지막 값을 쓴다.
 */
export function toChartSeriesModel(
  points: Array<Record<string, unknown>>,
): ChartSeriesModel {
  if (!points.some((p) => seriesNameOf(p) !== undefined)) {
    return { rows: points, series: [] };
  }
  const series: ChartSeries[] = [];
  const seriesKeyByName = new Map<string, string>();
  const rows: Array<Record<string, unknown>> = [];
  const rowByX = new Map<unknown, Record<string, unknown>>();
  for (const point of points) {
    const name = seriesNameOf(point) ?? "";
    let key = seriesKeyByName.get(name);
    if (key === undefined) {
      key = `s${series.length}`;
      seriesKeyByName.set(name, key);
      series.push({ key, name });
    }
    let row = rowByX.get(point.x);
    if (row === undefined) {
      row = { x: point.x };
      rowByX.set(point.x, row);
      rows.push(row);
    }
    row[key] = point.y;
  }
  return { rows, series };
}
