# Testing Review

## 발견사항

### [INFO] V101 마이그레이션 SQL 에 대한 전용 테스트 없음 (의도적 non-unique)
- 위치: `codebase/backend/migrations/V101__add_user_email_lower_index.sql`
- 상세: `CREATE INDEX IF NOT EXISTS idx_user_email_lower ON "user" (LOWER(email))` 는 마이그레이션 파일이므로 unit 테스트 대상이 아니다. 그러나 해당 인덱스가 실제 `emailTakenByOther` 쿼리 플랜에 사용되는지를 검증하는 e2e 레벨의 `EXPLAIN` 단언이 없다. 인덱스 의도(조회 가속)와 실제 동작 간 괴리를 런타임에서 검증할 방법이 현재 없고, plan 에 deferred 항목으로만 기록되어 있다. 프로덕션 대용량 환경 투입 전까지 맹점으로 남는다.
- 제안: 인덱스 존재 여부만이라도 e2e 에서 `pg_indexes` 카탈로그 쿼리로 단언 추가를 선택적으로 고려 (`SELECT indexname FROM pg_indexes WHERE indexname = 'idx_user_email_lower'`). 차단 사안은 아니지만 회귀 방지에 유효.

### [INFO] `seedPendingEmailChange` 헬퍼의 SQL Injection 잠재성 (테스트 코드 한정)
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L35-48
- 상세: `expiresSql` 파라미터가 파라미터 바인딩 없이 문자열 보간(`${expiresSql}`)으로 쿼리에 삽입된다. 테스트 코드라 프로덕션 위험은 없고, 실제 모든 호출처는 리터럴 SQL 표현식(`NOW() + INTERVAL '1 hour'`, `NOW() - INTERVAL '1 minute'`)을 사용하므로 현실적 위협은 없다. 그러나 향후 다른 개발자가 사용자 입력값을 `expiresSql` 에 전달하는 코드를 추가할 경우를 고려하면 제한적 위험이 있다.
- 제안: 허용 값을 enum 또는 `'future' | 'past'` 유니온으로 제한하고 내부에서 안전한 SQL 문자열을 선택하는 방식으로 변경하면 오남용을 원천 차단할 수 있다. 비차단 nit.

### [INFO] resend e2e — 토큰 갱신 단언이 해시 형식만 검증 (값 변경은 토큰 비교로 충분하나 timing gap 가능성)
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L258-268
- 상세: `before` snapshot 과 `after` 를 비교하여 `email_change_token` 이 달라졌는지, `email_change_expires_at` 가 이전보다 커졌는지를 단언한다. 이 단언 설계는 충분하나, `before` snapshot 을 `request` 직후(토큰 갱신 직후)와 `resend` 직전 사이의 시각 차가 없을 경우 `email_change_expires_at` 비교가 정확히 `>` 를 보장하지 못할 극단적 타이밍 가능성이 있다. 실제로 `request` 호출 후 `before` snapshot, 이후 `resend` 를 호출하므로 1 ms 이상 차이가 날 확률이 매우 높고 현실적으로 flaky 하지 않다.
- 제안: 현재 구조로 충분. 필요하다면 `before` 이전에 1 ms `sleep` 을 두거나 정수 비교 대신 `>=` 로 변경할 수 있으나 과도한 방어다.

### [INFO] verify-email-change 프론트엔드 테스트 — 로딩 상태(스피너) 단언 없음
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx`
- 상세: 세 테스트 케이스(성공/실패/토큰없음) 모두 최종 상태만 단언하며, `verifyEmailChange` 가 비동기 지연되는 동안의 로딩 UI(스피너 등)를 검증하지 않는다. 사용자가 빈 화면이나 깜빡이는 UI를 경험할 경우 이 테스트로는 감지되지 않는다. 이전 review(INFO 9)에서도 지적된 사항으로 비차단으로 분류된 바 있다.
- 제안: 선택 보강. `verifyEmailChange` 를 지연 resolve 하는 케이스를 추가하고 로딩 인디케이터 존재를 `findByTestId` 로 단언.

### [INFO] verify-email-change 테스트 — 409 RESOURCE_CONFLICT 응답(이메일 선점) 케이스 미커버
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx`
- 상세: 프론트엔드 verify 페이지는 API 에서 409를 받을 수 있으나(race 조건, spec §1.1.B), 현재 프론트엔드 unit 테스트는 일반 오류(`Error('expired')`)만 커버한다. 409 에 대해 다른 에러 메시지를 표시하는 분기가 구현에 있다면 해당 분기가 미커버 상태다.
- 제안: `verifyEmailChange.mockRejectedValue({ response: { status: 409 } })` 케이스를 추가하여 에러 UI가 적절히 표시되는지 단언. 구현에 분기가 없다면 현재 오류 처리 테스트로 충분.

### [INFO] profile-info-card 테스트 — `pendingEmail` 이 있을 때 resend/cancel 버튼 동작 단언 없음
- 위치: `codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx` L554-564
- 상세: `pendingEmail` 이 있을 때 "확인 대기 중: new@..." 텍스트는 단언하지만, spec §3.3 와이어프레임의 "[재발송] [취소]" 버튼 존재 여부 및 클릭 동작을 검증하지 않는다. 버튼이 렌더되는지, 클릭 시 적절한 API를 호출하는지가 미커버다.
- 제안: `getByRole('button', { name: /재발송/ })` 등으로 버튼 존재를 단언하고, `userEvent.click` 후 API mock 호출을 검증하는 케이스 추가.

### [INFO] i18n mock(`tFromKo`) 이 두 프론트엔드 테스트 파일에 중복
- 위치: `verify-email-change.test.tsx` 및 `profile-info-card.test.tsx`(간접 확인 필요)
- 상세: `tFromKo` 함수 구현이 `verify-email-change.test.tsx` 에 인라인으로 정의되어 있으며, 이전 review SUMMARY INFO 3에서 동일한 패턴이 다른 파일에도 중복된다고 지적된 바 있다. 테스트 간 공유 util 이 없어 유지보수 시 두 곳을 동기화해야 한다.
- 제안: `codebase/frontend/src/test-utils/i18n-mock.ts` 등으로 공통 추출. 비차단.

### [INFO] e2e — OAuth-only 계정의 403 REAUTH_NOT_AVAILABLE 케이스 미커버
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: unit 테스트에는 해당 케이스가 있으나 e2e 에서는 OAuth-only 계정(password_hash 없음)을 시드하는 테스트가 없다. e2e 환경에서 OAuth-only 계정을 시드하는 것이 어려울 수 있어 이전 review에서 비차단으로 분류되었다.
- 제안: DB 직접 시드(`UPDATE "user" SET password_hash = NULL`)로 OAuth-only 상태를 만들어 e2e 케이스 추가를 고려. 비차단.

### [INFO] e2e — `request` 의 대소문자 이메일 중복 검사(emailTakenByOther) 케이스 미커버
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: V101 인덱스 추가의 직접 동기인 `emailTakenByOther` 의 대소문자 무시 동작(예: `New@example.com` vs `new@example.com`)이 e2e 로 검증되지 않는다. 기능 정확성은 unit 레벨에서 검증되어야 하나, 인덱스가 실제 DB에서 해당 쿼리를 올바르게 처리하는지는 e2e에서만 확인 가능하다.
- 제안: `newEmail = uniqueEmail('emchg-case')` 를 `UPPER()` 변형으로 타 계정이 점유한 상태에서 request 시도 → 409 단언 케이스 추가. 비차단.

---

## 요약

이번 변경의 테스트 품질은 전반적으로 양호하다. 핵심 세 영역(백엔드 unit — `resend` 메일 실패 시 롤백 비대칭 동작, e2e — `resend` 토큰 갱신/pending 없음 400/verify race 409+pending 정리, 프론트엔드 unit — 검증 성공/실패/토큰없음)이 명확한 의도로 작성되어 있으며 격리성과 가독성도 적절하다. `seedPendingEmailChange` 헬퍼 추출(W3 fix)로 e2e 유지보수성이 향상되었고, `W2` 신규 테스트가 spec §1.1.B 비대칭 설계(resend 는 롤백 없음)를 정확히 문서화한다. 남은 갭(로딩 UI, 409 프론트엔드, pendingEmail 버튼 동작, i18n mock 중복, OAuth-only e2e, 대소문자 e2e, 인덱스 실사용 검증)은 모두 비차단 nit 수준이며 핵심 happy/unhappy path는 충분히 커버된다.

## 위험도

LOW
