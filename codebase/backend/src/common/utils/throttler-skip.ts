/**
 * `ThrottlerModule.forRoot({ skipIf })` 콜백.
 *
 * 옛 구성은 throttler 가 모든 환경에서 enabled 였다 (`limit: 100 / ttl: 60s`).
 * e2e 가 단일 컨테이너 IP 에서 90초 안에 100건 이상 `POST /auth/register`
 * 를 순차 호출 → `RATE_LIMITED` 로 14/15 suite 가 깨지는 사전 결함이 있었다.
 *
 * 해결: `NODE_ENV=test` 일 때만 throttler 전역 skip.
 * - production / development 동작은 무변경 (100/60s 그대로 강제)
 * - test 동안은 throttle 우회로 e2e 가 자체 폭주에 막히지 않는다
 * - throttler 자체 동작은 NestJS 내부 검증 책임 (외부 패키지) — 본 helper 의
 *   "test 분기" 동작만 단위 테스트로 회귀 보장
 *
 * 매 요청마다 호출되므로 env lookup 외 다른 부수 작업을 추가하지 말 것.
 */
export function shouldSkipThrottle(): boolean {
  return process.env.NODE_ENV === 'test';
}
