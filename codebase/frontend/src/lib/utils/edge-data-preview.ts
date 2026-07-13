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
/**
 * 직렬화 문자열이 이 길이를 넘으면 정확 바이트 인코딩(`TextEncoder`의 O(n) Uint8Array
 * 할당)을 건너뛰고 char 수(`full.length`)를 하한 근사치로 쓴다 — 대용량 출력을 가진 엣지에
 * 정착해 hover 할 때의 추가 할당 비용에 상한을 둔다. `bytesApprox=true` 로 표시.
 */
const BYTE_APPROX_THRESHOLD = 100_000;

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
  /** `bytes` 가 정확 인코딩이 아니라 근사치(대용량 상한 초과)면 true. */
  bytesApprox: boolean;
  /** 데이터가 없음(null/undefined). 이 경우 툴팁을 띄우지 않는다. */
  isEmpty: boolean;
}

export function summarizeDataForPreview(value: unknown): EdgeDataSummary {
  const isEmpty = value === undefined || value === null;
  let bytes = 0;
  let bytesApprox = false;
  try {
    const full = JSON.stringify(value);
    if (full) {
      if (full.length <= BYTE_APPROX_THRESHOLD) {
        bytes = new TextEncoder().encode(full).length; // 정확(멀티바이트 반영)
      } else {
        bytes = full.length; // 대용량: 인코딩 할당 생략, char 수 하한 근사
        bytesApprox = true;
      }
    }
  } catch {
    bytes = 0; // 순환 참조 등 직렬화 불가
  }
  let preview: string;
  try {
    preview = JSON.stringify(abbreviate(value, 0), null, 2) ?? String(value);
  } catch {
    preview = String(value);
  }
  return { preview, bytes, bytesApprox, isEmpty };
}

/** 바이트 크기를 사람이 읽기 좋은 문자열로. */
export function formatBytes(bytes: number): string {
  if (bytes < BYTES_PER_KB) return `${bytes} bytes`;
  if (bytes < BYTES_PER_KB * BYTES_PER_KB)
    return `${(bytes / BYTES_PER_KB).toFixed(1)} KB`;
  return `${(bytes / (BYTES_PER_KB * BYTES_PER_KB)).toFixed(1)} MB`;
}
