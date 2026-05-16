/**
 * `OAUTH_STUB_MODE=true` 가 현재 NODE_ENV 에서 honored 되는지 판정.
 *
 * - dev/test 에서만 활성. staging/production 환경에서는 stub 토큰이 실제 사용자
 *   데이터에 발급되어 인증 우회가 가능해지므로 강제 차단.
 * - `main.ts` 의 부트스트랩 fail-closed 가드와 별개의 layer — 운영 인스턴스가
 *   stub mode 로 부팅하는 것을 막고, 본 헬퍼는 코드 경로에서 stub 분기로 들어가는
 *   것을 막는다.
 *
 * 옛 코드 (auth-oauth.service.ts + integration-oauth.service.ts) 가 동일 로직을
 * 두 곳에 복제해 두고 있어 (W-74) 단일 source 로 통일.
 */
export function isOAuthStubModeAllowed(): boolean {
  if (process.env.OAUTH_STUB_MODE !== 'true') return false;
  const env = process.env.NODE_ENV;
  return env === 'test' || env === 'development';
}
