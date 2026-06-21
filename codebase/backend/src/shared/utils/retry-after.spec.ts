import { extractRetryAfterMs } from './retry-after';

describe('extractRetryAfterMs', () => {
  // 2026-05-19 — spec/4-nodes/3-ai/* multi-turn 오류 회복 흐름의 일부. RFC 7231
  // §7.1.3 Retry-After 두 형식 (delta-seconds / HTTP-date) 양쪽을 ms 로 정규화.
  // refactor M-9: llm.service.spec 에서 본 파일로 이동(함수 위치 정렬).
  it('extracts delta-seconds from headers["retry-after"]', () => {
    const err = { headers: { 'retry-after': '30' } };
    expect(extractRetryAfterMs(err)).toBe(30_000);
  });

  it('treats header name case-insensitively (Retry-After / RETRY-AFTER)', () => {
    expect(extractRetryAfterMs({ headers: { 'Retry-After': '5' } })).toBe(
      5_000,
    );
    expect(extractRetryAfterMs({ headers: { 'RETRY-AFTER': '2' } })).toBe(
      2_000,
    );
  });

  it('reads response.headers when top-level headers absent', () => {
    const err = { response: { headers: { 'retry-after': '12' } } };
    expect(extractRetryAfterMs(err)).toBe(12_000);
  });

  it('parses HTTP-date format (RFC 7231 §7.1.1.1)', () => {
    const future = new Date(Date.now() + 5_000).toUTCString();
    const ms = extractRetryAfterMs({ headers: { 'retry-after': future } });
    // 시계 차이 ±500ms 허용 (Date.now() vs Date.parse 라운딩).
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(4_000);
    expect(ms!).toBeLessThan(6_000);
  });

  it('returns 0 when HTTP-date is already in the past', () => {
    const past = new Date(Date.now() - 5_000).toUTCString();
    expect(extractRetryAfterMs({ headers: { 'retry-after': past } })).toBe(0);
  });

  it('returns null for missing headers', () => {
    expect(extractRetryAfterMs({})).toBeNull();
    expect(extractRetryAfterMs({ headers: {} })).toBeNull();
    expect(
      extractRetryAfterMs({ headers: { 'retry-after': null } }),
    ).toBeNull();
  });

  it('returns null for non-object errors and primitives', () => {
    expect(extractRetryAfterMs(null)).toBeNull();
    expect(extractRetryAfterMs(undefined)).toBeNull();
    expect(extractRetryAfterMs('429 rate limited')).toBeNull();
    expect(extractRetryAfterMs(429)).toBeNull();
  });

  it('returns null for invalid string values (not parseable as seconds or date)', () => {
    expect(
      extractRetryAfterMs({ headers: { 'retry-after': 'soon' } }),
    ).toBeNull();
    expect(extractRetryAfterMs({ headers: { 'retry-after': '' } })).toBeNull();
  });

  it('returns null for negative delta-seconds (defensive)', () => {
    // RFC 는 0 이상 delta-seconds 만 정의. 음수는 서버 버그 — fallback 사용.
    expect(
      extractRetryAfterMs({ headers: { 'retry-after': '-5' } }),
    ).toBeNull();
  });

  it('handles delta-seconds as number type (header value not stringified)', () => {
    // 일부 SDK 가 헤더 값을 이미 number 로 노출할 수 있음.
    expect(extractRetryAfterMs({ headers: { 'retry-after': 15 } })).toBe(
      15_000,
    );
  });
});
