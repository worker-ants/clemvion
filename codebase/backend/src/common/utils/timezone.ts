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
