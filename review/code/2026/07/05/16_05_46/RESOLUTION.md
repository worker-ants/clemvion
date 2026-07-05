# RESOLUTION — invite-accept-confirm-ui final review (16_05_46)

## 조치 항목

| # | Reviewer/위험도 | 발견 | 조치 | 커밋 |
|---|---|---|---|---|
| 1 | testing / WARNING(LOW) | accept 페이지 logout-실패 테스트가 `storeLogoutMock`·`/login` 만 단언하고 `authApi.logout()`(서버 호출) 호출 자체는 단언하지 않아, try/`authApi.logout()`/catch 블록을 통째로 제거한 회귀도 통과함 | 실패-경로 테스트에 `expect(mockLogout).toHaveBeenCalled()` 추가 — 서버 logout 이 실제 시도됐고(실패) 그럼에도 클라 세션이 정리됨을 증명. test-only(프로덕션 코드·동작 불변) | (아래 test 커밋) |

나머지 8개 Agent(requirement·side_effect·security·cross_spec·rationale·convention·plan_coherence·naming) 위험도 NONE — logout() fix 및 V-09 전체 변경 최종 정합 검증 완료.

> 조치 #1 은 testing 리뷰어가 요청한 단언을 그대로 추가한 test-only 변경(프로덕션/spec 코드 무변경)이라 별도 fresh 리뷰 라운드 없이 본 16_05_46 리뷰가 커버한다. (프로덕션 코드는 05c589936 에서 불변 → 직전 e2e 235 PASS 유효.)

## TEST 결과

- lint: 통과 (재수행)
- unit: 통과 (재수행 — accept 9 / register 10)
- build: 통과 (직전 05c589936 에서 PASS, 이번 test-only 변경 무영향)
- e2e: 통과 (재수행, 235 passed)

## 보류·후속 항목

없음.
