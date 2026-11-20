/**
 * 제품 기본 시간대. 워크스페이스 `settings.timezone` 이 없거나 무효일 때 스케줄과
 * AI 시스템 컨텍스트 접두가 함께 쓰는 폴백이다. 감사 로그 보존 배치의 실행 시각(03:30)도
 * 이 시간대로 정한다. 서버 `process.env.TZ` 는 읽지 않는다(CLE-ACCT-WS 「기본 시간대」,
 * CLE-T-TNZ3J9 결정).
 */
export const PRODUCT_DEFAULT_TIMEZONE = 'Asia/Seoul';

/**
 * IANA 타임존 유효성 — `Intl.DateTimeFormat` 가 throw 하지 않으면 유효한 식별자다.
 *
 * @param tz 검사할 타임존 문자열 (예: `Asia/Seoul`, `UTC`, `America/New_York`).
 * @returns 유효하면 `true`, 빈 문자열·오타·미지원 식별자면 `false`.
 * @example isValidIanaTimezone('Asia/Seoul') // true
 * @example isValidIanaTimezone('Not/AZone')  // false
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (typeof tz !== 'string' || tz.length === 0) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}
