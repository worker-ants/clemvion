# 테스트(Testing) Review

## 발견사항

### [INFO] e2e resend 테스트에서 만료 시각(email_change_expires_at) 갱신을 미검증
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L211-245 (신규 추가된 `resend → 200; 토큰·만료 시각 갱신` 테스트)
- 상세: `after` 쿼리에서 `email_change_expires_at` 컬럼을 SELECT 하지만 실제로 "before 대비 값이 갱신됐는지" 를 `expect` 로 단언하지 않는다. `before.rows[0].email_change_expires_at` 와 비교하거나 `after.rows[0].email_change_expires_at` 가 미래임을 확인하는 assertion 이 빠져 있다.
- 제안:
  ```ts
  expect(new Date(after.rows[0].email_change_expires_at).getTime())
    .toBeGreaterThanOrEqual(new Date(before.rows[0].email_change_expires_at).getTime());
  ```
  또는 `before`/`after` 의 `email_change_expires_at` 를 직접 비교해 실제 TTL 연장을 단언한다.

### [INFO] e2e 성공 verify 테스트에서 toast.success 호출 미검증 (프론트엔드)
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx` L541-553 (첫 번째 케이스)
- 상세: `verifyEmailChange` 성공 시 컴포넌트는 `toast.success(t("profile.changeEmailVerifySuccess"))` 를 호출하지만 테스트에서 `toast.success` 를 `import` 해 `expect(toast.success).toHaveBeenCalled()` 를 검증하지 않는다. `sonner` 가 mock 으로 설정돼 있으므로 쉽게 추가할 수 있다.
- 제안: `waitFor` 블록 안에 `expect(toast.success).toHaveBeenCalled()` 를 추가한다.

### [INFO] REAUTH_NOT_AVAILABLE(403) 케이스가 e2e 레벨에서 미검증
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: spec §1.1.B 는 `password_hash` 도 2FA 도 없는 OAuth-only 계정에 `403 REAUTH_NOT_AVAILABLE` 을 명시한다. unit 테스트(`sessions.service.spec.ts` L344, `auth.service.spec.ts` L1093-1108) 에는 커버되어 있으나, e2e 파일에는 OAuth-only 사용자 픽스처로 403 응답을 검증하는 시나리오가 없다. e2e 환경에서 OAuth-only 사용자 생성이 어려운 경우 주석으로 사유를 문서화하는 것이 권장된다.
- 제안: e2e 환경이 OAuth-only 사용자를 DB 직접 시드로 생성 가능하다면 테스트 케이스 추가를 고려한다. 불가능한 경우 `// OAuth-only 사용자는 DB fixture 미지원 — unit 커버리지로 대체` 주석 삽입.

### [INFO] e2e resend 테스트가 TOTP/WebAuthn 재인증 경로 없이 password 기반만 검증
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` L211-245
- 상세: resend 는 재인증 없이 pending 이메일에만 의존하므로 이 자체는 문제가 없다. 단, `request` 단계에서 e2e 전체가 `TEST_PASSWORD` 기반만 사용하고 TOTP 재인증 경로는 e2e 에서 검증되지 않는다. unit 테스트(`sessions.service.spec.ts`) 에서 TOTP 경로가 커버되므로 비차단 INFO 수준으로 분류한다.
- 제안: 추후 e2e TOTP fixture 가 마련되면 커버리지 추가를 고려한다.

### [INFO] 대소문자 무시 중복 검사(V101 인덱스 대상 쿼리) e2e 시나리오 부재
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts` / `codebase/backend/migrations/V101__add_user_email_lower_index.sql`
- 상세: V101 마이그레이션이 추가한 `idx_user_email_lower` 는 `emailTakenByOther` 의 `WHERE LOWER(u.email) = LOWER(:email)` 쿼리 가속이 목적이다. 기능 정확성은 unit 테스트로 커버되지만, e2e 에서 대소문자 변형 중복(`TEST@EXAMPLE.COM` vs `test@example.com`) 을 실제로 거부하는 시나리오는 없다. 인덱스 자체는 기능에 영향이 없으나 plan 문서에 "EXPLAIN 확인" 이 ToDo 로 남아 있다.
- 제안: 가능하면 `request rejects email already used by another account (409)` 기존 케이스에 대소문자 변형 검사(`TEST@EXAMPLE.COM` → 409) 케이스를 한 줄 추가한다.

### [INFO] VerifyEmailChangePage 단위 테스트에서 로딩 상태(spinner) 표시 검증 미포함
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/__tests__/verify-email-change.test.tsx`
- 상세: 컴포넌트는 `verifyEmailChange` 가 resolve 되기 전 `data-testid="email-change-verifying"` 스피너를 표시한다. 세 테스트 케이스 중 어느 것도 로딩 인디케이터가 초기 렌더에 존재하고 완료 후 사라지는 것을 단언하지 않는다. 사용자 경험상 중요한 상태이지만 낮은 우선순위이다.
- 제안: 성공 케이스에서 `waitFor` 이전에 `expect(screen.getByTestId("email-change-verifying")).toBeInTheDocument()` 추가를 고려한다.

---

## 요약

신규 추가된 e2e 테스트 3건(resend 정상/예외, verify race condition)과 프론트엔드 단위 테스트(VerifyEmailChangePage, ProfileInfoCard)는 전체적으로 핵심 플로우를 잘 커버한다. 기존 unit 테스트도 `requestEmailChange`/`verifyEmailChange`/`resendEmailChange`/`cancelEmailChange`/`emailTakenByOther`/`reauthenticate` 메서드를 상세히 검증하고 있어 Critical·Warning 수준의 공백은 없다. 미비점은 모두 INFO 수준이며: (1) resend e2e 에서 `email_change_expires_at` 갱신 단언 누락, (2) 성공 경로 `toast.success` 미검증, (3) OAuth-only 403 경로가 e2e 미커버, (4) 대소문자 중복 검사의 e2e 시나리오 부재이다. 테스트 격리와 가독성은 양호하며, DB 직접 시드 패턴을 일관되게 사용해 race condition 시나리오를 명확히 표현하고 있다.

## 위험도

LOW
