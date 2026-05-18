/**
 * Cafe24 토큰 만료 시각 처리 공유 유틸리티.
 *
 * `parseTokenExpiresAt` (integration-oauth.service.ts) 와 `refreshAccessToken`
 * (nodes/integration/cafe24/cafe24-api.client.ts) 가 동일한 cafe24 토큰
 * 만료 시각 파싱 precedence (JWT exp → expires_in → expires_at ISO →
 * 2h default) 와 TZ 정규화 정책을 공유한다. 두 곳에 같은 정규식/문자열
 * 처리를 중복하면 향후 Cafe24 의 응답 표기 변경 시 한쪽만 갱신될
 * drift 위험이 있어 본 모듈로 단일 진입점 통일.
 *
 * spec/2-navigation/4-integration.md ## Rationale "Cafe24 token 만료 SoT —
 * JWT exp 격상 (2026-05-18)".
 */

/**
 * ISO8601 문자열에 timezone designator (`Z` 또는 `±HH:MM` / `±HHMM`) 가
 * 포함됐는지 검사. 없으면 caller 가 `normalizeCafe24IsoTimezone` 으로
 * KST (`+09:00`) 를 부여한다.
 */
export function hasTimezoneDesignator(iso: string): boolean {
  return /Z$|[+-]\d{2}:?\d{2}$/.test(iso);
}

/**
 * Cafe24 의 `/oauth/token` 응답이 TZ designator 없는 ISO 를 보내면 KST
 * (`+09:00`) 부여로 정규화. 옛 코드는 `Date.parse` 가 ECMA-262 사양상
 * TZ-less ISO 를 *서버 local time* 으로 해석해 UTC 컨테이너에서 9h skew
 * 가 발생해 proactive refresh 와 워커 short-circuit 이 동시에 빗나가는
 * 회귀가 있었다 (사용자 보고 2026-05-18).
 *
 * 본 정규화는 JWT exp 파싱이 비정상으로 null 인 경우의 fallback 안전망.
 */
export function normalizeCafe24IsoTimezone(iso: string): string {
  return hasTimezoneDesignator(iso) ? iso : `${iso}+09:00`;
}
