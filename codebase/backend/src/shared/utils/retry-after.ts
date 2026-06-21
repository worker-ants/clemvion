/**
 * Provider SDK 가 throw 한 에러에서 RFC 7231 Retry-After 헤더를 추출해 ms 로
 * 정규화. Anthropic / OpenAI SDK 의 APIError 류는 `headers` 또는
 * `response.headers` 에서 헤더를 노출한다.
 *
 * RFC 7231 §7.1.3:
 *  - delta-seconds: `30`
 *  - HTTP-date: `Mon, 11 Jun 2025 00:00:00 GMT`
 *
 * 양쪽 모두 ms 로 변환. 음수·NaN·parse 실패·헤더 누락 시 null (caller 가
 * exponential fallback 사용).
 *
 * refactor M-9: 물리 위치가 spec 무언급(`node-output.md §3.2.1` 은 `retryAfterSec`
 * 의미만 규정)이라 `llm.service.ts` 에서 본 `shared/utils/` 로 이동 —
 * `sanitizeLastErrorMessage` 선례와 동일. retry-after 만 필요한 소비자가 llm 모듈을
 * import 하던 결합을 끊는다. 재발 차단을 위해 `llm.service` 에 re-export 는 두지 않는다.
 */
export function extractRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const errObj = err as {
    headers?: unknown;
    response?: { headers?: unknown } | null;
  };
  const rawHeaders =
    errObj.headers ??
    (errObj.response && typeof errObj.response === 'object'
      ? errObj.response.headers
      : undefined);
  if (!rawHeaders || typeof rawHeaders !== 'object') return null;
  const headers = rawHeaders as Record<string, unknown>;
  const rawValue =
    headers['retry-after'] ?? headers['Retry-After'] ?? headers['RETRY-AFTER'];
  if (rawValue === undefined || rawValue === null) return null;
  // 헤더 값은 보통 string 이지만 일부 클라이언트가 number / array 로 wrap 해서 반환할 수 있다.
  // string / number 가 아니면 의미 있는 변환이 불가능하므로 null.
  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') return null;
  const str = String(rawValue).trim();
  if (str.length === 0) return null;
  // delta-seconds 우선 시도 (간단한 형식, parseFloat 가 ISO 날짜의 첫 숫자를
  // 잘못 잡지 않도록 Number() 로 strict 변환).
  const seconds = Number(str);
  if (Number.isFinite(seconds)) {
    // 음수 delta-seconds 는 RFC 7231 위반 — fallback 사용. 일부 JS 엔진의
    // `Date.parse('-5')` 가 비표준 결과를 반환할 수 있어 여기서 explicit
    // reject 로 차단.
    if (seconds < 0) return null;
    return Math.floor(seconds * 1000);
  }
  // HTTP-date format — Date.parse 로 epoch ms 환산 후 now 와 차이를 계산.
  const dateMs = Date.parse(str);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}
