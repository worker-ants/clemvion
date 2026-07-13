/**
 * §5 — 엣지 데이터 미리보기(Data Flow Preview) 축약. 실행 후 엣지 hover 툴팁이 보여줄
 * "축약된 미리보기 문자열 + 원본 바이트 크기" 를 계산한다. React/스토어에 의존하지 않는
 * 순수 함수라 단위 테스트가 쉽다.
 *
 * 축약 규칙(spec §5 "큰 데이터는 축약 표시 — 배열 길이·객체 필드 수"):
 *  - 최상위 객체/배열은 한 단계만 펼치고, 그 안의 중첩 배열은 `[N items]`, 중첩 객체는
 *    `{N fields}` 로 요약한다.
 *  - 최상위 배열은 앞 몇 개만 보여주고 나머지는 `…(N more)` 로 줄인다.
 *  - 긴 문자열은 잘라서 `…` 를 붙인다.
 */

const MAX_STRING = 80;
const MAX_TOP_ARRAY = 5;
const MAX_TOP_KEYS = 20;
const BYTES_PER_KB = 1024;

function abbreviate(value: unknown, depth: number): unknown {
  if (value === null) return null;
  if (Array.isArray(value)) {
    if (depth >= 1) return `[${value.length} items]`;
    const shown = value.slice(0, MAX_TOP_ARRAY).map((v) => abbreviate(v, depth + 1));
    return value.length > MAX_TOP_ARRAY
      ? [...shown, `…(${value.length - MAX_TOP_ARRAY} more)`]
      : shown;
  }
  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (depth >= 1) return `{${entries.length} fields}`;
    const out: Record<string, unknown> = {};
    for (const [k, v] of entries.slice(0, MAX_TOP_KEYS)) {
      out[k] = abbreviate(v, depth + 1);
    }
    if (entries.length > MAX_TOP_KEYS) {
      out["…"] = `${entries.length - MAX_TOP_KEYS} more fields`;
    }
    return out;
  }
  if (typeof value === "string" && value.length > MAX_STRING) {
    return value.slice(0, MAX_STRING) + "…";
  }
  return value;
}

export interface EdgeDataSummary {
  /** 축약된 미리보기 (2-space pretty JSON, 중첩 컬렉션은 요약 문자열). */
  preview: string;
  /** 원본 데이터를 JSON 직렬화했을 때의 바이트 크기(직렬화 불가면 0). */
  bytes: number;
  /** 데이터가 없음(null/undefined). 이 경우 툴팁을 띄우지 않는다. */
  isEmpty: boolean;
}

export function summarizeDataForPreview(value: unknown): EdgeDataSummary {
  const isEmpty = value === undefined || value === null;
  let bytes = 0;
  try {
    const full = JSON.stringify(value);
    if (full) bytes = new TextEncoder().encode(full).length;
  } catch {
    bytes = 0; // 순환 참조 등 직렬화 불가
  }
  let preview: string;
  try {
    preview = JSON.stringify(abbreviate(value, 0), null, 2) ?? String(value);
  } catch {
    preview = String(value);
  }
  return { preview, bytes, isEmpty };
}

/** 바이트 크기를 사람이 읽기 좋은 문자열로. */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} bytes`;
  if (bytes < BYTES_PER_KB * BYTES_PER_KB)
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / (BYTES_PER_KB * BYTES_PER_KB)).toFixed(1)} MB`;
}
