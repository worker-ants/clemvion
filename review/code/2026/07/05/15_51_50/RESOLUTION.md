# RESOLUTION — invite-accept-confirm-ui fresh round 2 (15_51_50)

## 조치 항목

| # | Reviewer/위험도 | 발견 | 조치 | 커밋 |
|---|---|---|---|---|
| 1 | requirement / WARNING | `handleLogout`(accept 페이지)이 store `logout()` 대신 `setAccessToken(null)+setUser(null)` 을 직접 호출 → `has_session` 힌트 쿠키·`isAuthenticated` 플래그 미정리. 이번 PR 이 has_session 을 register 리다이렉트의 load-bearing 신호로 만들었기에, mismatch-logout 후 stale 쿠키가 남아 재진입 시 잘못 리다이렉트(보안 우회 아님 — 서버 refresh 토큰은 정상 무효화) | `accept-invitation-content.tsx` handleLogout 을 `useAuthStore.getState().logout()` 로 교체(access token·has_session 쿠키·인증 플래그 일괄 정리). 미사용된 `setAccessToken` import 제거. 테스트를 `storeLogoutMock` assert 로 갱신 | (아래 fix 커밋) |

나머지 8개 Agent(security·side_effect·documentation·scope·cross_spec·rationale·convention·plan_coherence) 위험도 NONE — 직전 라운드 WARNING(has_session dead-code·CHANGELOG·§2.6 미러) 조치가 모두 정상 검증됨.

## TEST 결과

- lint: 통과 (재수행)
- unit: 통과 (재수행 — accept 9 / register 10)
- build: 통과 (재수행)
- e2e: 통과 (재수행, 235 passed)

## 보류·후속 항목

없음. (익명 직접진입 login 쿼리 유실은 15_33_01 RESOLUTION §보류에서 별도 트랙으로 이관 완료.)
