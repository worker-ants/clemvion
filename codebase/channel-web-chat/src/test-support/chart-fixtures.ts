// 차트 색 허용 규칙 · 시리즈 묶음 규칙의 공유 픽스처(codebase/shared-fixtures/chart/)를 읽는다.
// 에디터(chart-series.test.ts) · 백엔드(chart.handler.spec.ts) 테스트도 같은 파일을 읽으므로
// 한쪽 규칙만 바뀌면 그쪽 테스트가 실패한다(NERV Task CLE-T-NRN1RR).
import { readFileSync } from "node:fs";
import path from "node:path";

// jsdom 환경에서는 import.meta.url 이 file: URL 이 아니라서 __dirname 으로 찾는다.
const FIXTURE_DIR = path.resolve(__dirname, "../../../shared-fixtures/chart");

export interface ChartColorCorpus {
  maxLength: number;
  accepted: string[];
  trimmed: Array<[string, string]>;
  rejected: unknown[];
}

/** 렌더러가 그리는 모양. X 순서 · 시리즈 이름(단일 시리즈면 빈 배열) · 시리즈 × X 값(없으면 null). */
export interface ChartRenderShape {
  x: unknown[];
  series: string[];
  values: Array<Array<number | null>>;
}

export interface ChartSeriesCase {
  name: string;
  points: Array<Record<string, unknown>>;
  render: ChartRenderShape;
}

function readFixture<T>(file: string): T {
  return JSON.parse(readFileSync(path.join(FIXTURE_DIR, file), "utf8")) as T;
}

export const chartColorCorpus: ChartColorCorpus = readFixture("colors.json");
export const chartSeriesCases: ChartSeriesCase[] = readFixture<{ cases: ChartSeriesCase[] }>(
  "series.json",
).cases;
