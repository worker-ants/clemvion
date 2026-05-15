# Resolution — 2026-05-13_16-47-51

`SUMMARY.md` 의 5건 Warning 과 일부 INFO 를 본 PR 안에서 조치한다. 모든 변경은 `worktree-fix-login-history-e2e` 브랜치의 후속 커밋(테스트 보강 + 문서 정리)에 포함된다.

## Warning 조치 (5건)

### W1 — `await` 전환 회귀 가드 (Testing)

`backend/src/modules/auth/auth.service.spec.ts` 의 `describe('login')` 안에 `await contract: returns only after loginHistory.record resolves` 케이스 추가. 지연 Promise(`setTimeout(... , 30)`) 를 mock 에 주입해 `record()` 가 resolve 한 뒤에야 `login()` 이 반환되는지 검증한다. 누군가 다시 `void` 로 되돌리면 `recordResolved === false` 로 즉시 실패한다.

### W2 — record() 호출 자체의 회귀 가드 (Testing)

`describe('login')` 에 `records login_success on successful login` 케이스 추가. 성공 경로에서 `loginHistory.record` 가 `event: 'login_success'` + 올바른 `userId/email` 로 호출됐는지 toHaveBeenCalledWith 로 박제. 미래에 record 호출 자체가 사라지는 회귀를 차단한다.

> 참고: 리뷰가 처음 제안한 "`repository.save` throw 시 login 정상 반환" 시나리오는 `LoginHistoryService.record()` 단위 테스트(`login-history.service.spec.ts:96` — `swallows save errors so auth flow continues`) 가 이미 보장한다. AuthService 레벨에서 또 한번 재현하려면 진짜 repository 를 주입하는 통합 테스트 셋업이 필요해, 본 PR 에서는 동등 보장이 되는 위치(LoginHistoryService) 의 기존 테스트로 갈음한다.

### W3 — e2e 케이스 의도 고정 (Testing)

`backend/test/session-revocation.e2e-spec.ts` 의 "E. login-history" 케이스 상단에 `regression: void → await race (fix-login-history-race)` 주석을 추가해 race 검증이 본 케이스의 목적임을 박제. 향후 케이스를 단순화하거나 skip 할 때 의도를 잃지 않는다.

### W4 — DB 불가 시 보안 이벤트 무음 소실 (Security)

`record()` 의 best-effort 설계는 spec(`5-system/1-auth.md §4.3` 의 LoginHistory 정의 + Rationale) 의 의도된 tradeoff 다. 본 PR 의 fix 는 race 해소가 본 scope 이므로 중기 보완(인메모리 큐 / 메트릭 카운터) 은 별도 plan 으로 분리한다. `login-history.service.ts#record` 의 JSDoc 에 swallow 동작이 이미 명시돼 있고, `this.logger.error` 가 호출되므로 모니터링에서는 감지 가능하다 — 현재 contract 유지.

### W5 — Plan 라이프사이클 정리 (Documentation)

`plan/in-progress/fix-login-history-race.md` 의 모든 체크박스가 완료된 상태이므로 본 RESOLUTION 커밋과 함께 `git mv plan/in-progress/fix-login-history-race.md plan/complete/fix-login-history-race.md` 로 이동한다.

## 추가 조치 (INFO 중 빠른 항목)

### I7 — forgotPassword 의 record 미호출 회귀 가드

`describe('forgotPassword')` 에 `does not record a login-history event` 케이스 추가. spec §4.3 이 forgot/reset 이벤트를 enum 에 포함하지 않으므로 의도된 omission 임을 단언으로 박제한다.

## 보류 (별도 이슈로 추적 권장)

- I1 `@typescript-eslint/no-floating-promises` 활성화 — 전체 코드베이스의 다른 `void promise` 패턴까지 영향을 주므로 단독 PR 로 분리하는 게 안전.
- I2 `historyInput(ctx, partial)` 헬퍼 — 15 호출부 매핑 중앙화. 리팩토링 PR 별도.
- I4 `ACCOUNT_LOCKED` 메시지 계정 열거 — spec 정의 후 일괄 정리.
- I5 prune 인라인 SQL — 현재 안전하나 user input 유입 시 위험. 리팩토링 PR 별도.
- I8 cursor 페이지네이션 인덱스 점검 — `V040` 의 `idx_login_history_user_created` 가 `(user_id, created_at DESC)` 인데, secondary tiebreaker 인 `id DESC` 가 인덱스에 없어 동일 ms row 다발 시 sort 비용이 미세하게 든다. 현재 row 빈도(사용자당 분당 한 자리 수) 에서는 무시 가능. 추후 트래픽 증가 시 별도 이슈.
- I9 forgot/reset 의 audit 이벤트 부재 — spec 변경 동반 작업이므로 기획자 검토 필요.
- I11 prune 다중 인스턴스 — cron 단일 인스턴스 운영 가정. 분산 환경 도입 시점에 재검토.
- I12 TOTP 챌린지 이벤트 부재 — spec 차원 결정.

## 테스트 재실행

- `npm run lint` — pass
- `npm test` — 188 suites, 3296 tests pass (+3 new)
- `npm run build` — pass
- `make e2e-test` — 11 suites, 63 tests pass
