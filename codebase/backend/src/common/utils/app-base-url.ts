/**
 * APP_URL 의 단일 표준 fallback + 후행 슬래시 제거 헬퍼.
 *
 * 옛 코드는 `process.env.APP_URL || 'http://localhost:3011'` 패턴이 6곳에
 * 반복되어 (integrations.service.ts × 2, integration-oauth.service.ts × 4)
 * `.replace(/\/$/, '')` 호출 누락 / fallback 변경 시 일부만 갱신되는 위험이
 * 있었다 (W-28). 단일 진입점으로 강제.
 *
 * - dev 기본값: `http://localhost:3011`
 * - 후행 슬래시는 항상 제거 — 호출자가 `${baseUrl}/api/...` 형태로 안전하게 합성
 */
export function getAppBaseUrl(): string {
  const raw = process.env.APP_URL || 'http://localhost:3011';
  return raw.replace(/\/$/, '');
}
