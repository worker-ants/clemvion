# 테스트(Testing) 리뷰 결과

대상: 이메일 변경 프로세스 구현 — resolution 적용 후 재검토 (spec/5-system/1-auth.md §1.1.B)
리뷰일: 2026-06-21

---

## 발견사항

### [INFO] 이전 SUMMARY W1~W4 테스트 추가 — 완전히 해소됨

- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts`, `sessions.service.spec.ts`, `users.service.spec.ts`, `mail.service.spec.ts`
- 상세: 이전 리뷰(18_29_37)에서 WARNING으로 지적된 4개 서비스 레이어 단위 테스트 부재가 전부 해소됐다.
  - `auth.service.spec.ts` — `requestEmailChange`(6케이스), `verifyEmailChange`(6케이스), `resendEmailChange`(2케이스), `cancelEmailChange`(2케이스) 추가. SHA-256 round-trip 검증, clearPendingEmailChange 롤백 경로, logger.warn best-effort 경로 모두 커버.
  - `sessions.service.spec.ts` — `reauthenticate` 3케이스(user 없음 401, 정상 비밀번호, OAuth-only 403) 추가.
  - `users.service.spec.ts` — `emailTakenByOther` 3케이스(true/false/QBuilder 파라미터 검증) 추가.
  - `mail.service.spec.ts` — `sendEmailChangeVerification` 3케이스, `sendEmailChangedNotice` 3케이스(XSS 이스케이프 포함) 추가.
- 위험도 변화: 이전 MEDIUM → 현재 기준 커버리지 상태 양호.

---

### [INFO] `isUniqueEmailViolation` private 메서드의 `driverError.code` 분기 단위 테스트 여전히 미존재

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` (L985), `auth.service.spec.ts`
- 상세: `isUniqueEmailViolation` 은 `e.code === '23505'` 와 `e.driverError?.code === '23505'` 두 분기를 갖는다. 현재 `auth.service.spec.ts` 의 `verifyEmailChange` 테스트에서 `emailTakenByOther.mockResolvedValue(true)` 경로만 커버하며, DB 자체에서 23505 에러가 throw 되는 `isUniqueEmailViolation` 경로(update 시 UNIQUE 제약 위반 catch 블록)는 검증되지 않는다. `driverError.code` 중첩 경로가 실제 TypeORM 에러 구조와 일치하는지 검증하지 않는다.
- 제안: `auth.service.spec.ts` 에 `isUniqueEmailViolation` 직접 호출 또는 `verifyEmailChange update` 단계에서 `{ code: '23505' }` / `{ driverError: { code: '23505' } }` 두 케이스 모두 throw 시키는 테스트 추가.

---

### [INFO] `verify/page.tsx` 테스트 부재 — 유지

- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/` — `__tests__` 디렉토리 없음
- 상세: `verify/page.tsx` 에 대한 테스트 파일이 여전히 없다. `page.tsx` 는 URL 토큰을 1회성으로 소비해 `setAccessToken` 을 갱신하고 `router.replace('/profile')` 로 리다이렉트하는 비자명 흐름을 포함하며, `useRef(false)` Strict Mode guard 도 검증이 필요하다. 핵심 검증 경로: (1) 토큰 없을 때 `changeEmailMissingToken` 메시지 표시, (2) API 성공 시 accessToken 교체 + 리다이렉트, (3) API 실패 시 에러 메시지.
- 제안: `verify/__tests__/verify-email-change.test.tsx` 를 생성해 세 경로 커버. Strict Mode guard 재실행 방지도 검증.

---

### [INFO] `profile-info-card.tsx` `pendingEmail` 조건부 렌더링 테스트 미추가 — 유지

- 위치: `codebase/frontend/src/app/(main)/profile/components/` — 기존 `profile-info-card.test.tsx` 존재 여부 및 `pendingEmail` 케이스
- 상세: `profile-info-card.tsx` 에 `pendingEmail` prop 이 추가되고 `data-testid="profile-email-pending"`, `data-testid="profile-change-email-link"` 가 조건부로 렌더링된다. 기존 테스트의 `renderCard` 헬퍼가 `pendingEmail` 케이스를 커버하는지 확인이 필요하다. 미커버 시 pendingEmail 있을 때 pending 라벨 표시, 없을 때 CTA 링크 표시 두 케이스 추가가 필요하다.
- 제안: `pendingEmail: "pending@x.com"` 케이스와 `pendingEmail: null` 케이스 각각 추가.

---

### [INFO] `change-email.test.tsx` — cancel 성공 UI와 request 실패 에러 케이스 미커버

- 위치: `codebase/frontend/src/app/(main)/profile/change-email/__tests__/change-email.test.tsx`
- 상세: 현재 테스트는 (1) 정상 submit, (2) pending 상태 표시 + resend 호출 두 케이스만 검증한다. 다음이 미커버: cancel 버튼 클릭 시 `cancelEmailChange` 호출 + pending 상태 해제 UI, `requestEmailChange` API 실패 시 에러 toast 표시, TOTP 코드만 제출하는 경로. `cancelEmailChange` mock 이 이미 정의되어 있으나 해당 동작을 트리거하는 케이스가 없다.
- 제안: cancel 성공 후 pending 상태 해제 UI 확인 케이스 및 request 실패 에러 toast 케이스 추가.

---

### [INFO] e2e — resend 엔드포인트 미검증 — 유지

- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: e2e 테스트가 `request`, `verify`(성공/실패/409), `cancel`(멱등)을 커버하지만 `POST /api/users/me/email-change/resend` 는 검증하지 않는다. resend 는 토큰·만료 시각을 갱신하는 사이드이펙트가 있어 DB 상태 변경 검증이 유효하다.
- 제안: resend 시나리오 추가: pending 상태 시드 → resend 호출 → `email_change_token` 이 이전과 달라졌는지, `email_change_expires_at` 이 갱신됐는지 확인.

---

### [INFO] e2e — verify 시점 race condition 경로(이메일 선점 409) 미검증 — 유지

- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: `verifyEmailChange` 서비스 코드가 verify 시점에 `emailTakenByOther` 재검사 후 `ConflictException` 을 던지는 경로가 있다. 단위 테스트(`auth.service.spec.ts` L1220)에서 mock 으로 커버되지만, 실제 DB UNIQUE 제약 발동 경로(update 자체에서 23505 위반)는 e2e 에서만 검증 가능하다. 현재 e2e 에는 이 시나리오(request 후 타 계정이 동일 이메일로 가입 완료 → verify 409)가 없다.
- 제안: "verify 시점 이메일 선점 409" 케이스 추가.

---

### [INFO] `reauthenticate` TOTP 경로 단위 테스트 미커버

- 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts` — `reauthenticate` describe 블록
- 상세: 추가된 `reauthenticate` 테스트 3케이스는 (1) user 없음 401, (2) 정상 비밀번호, (3) OAuth-only 403 를 커버하지만, `totpCode` 만 제출하는 경우(비밀번호 없음 + TOTP 있음)와 잘못된 TOTP 코드 → `TOTP_INVALID` 경로는 테스트되지 않는다. `verifyReauth` 가 기존 테스트에서 커버되므로 블로킹 수준은 아니다.
- 제안: `reauthenticate` describe 에 totpCode 경로 케이스 1~2개 추가하면 public wrapper 의 위임 정확성 검증이 완전해진다.

---

## 요약

이전 리뷰(18_29_37)에서 MEDIUM 위험도의 근거였던 서비스 레이어 단위 테스트 전무 문제(W1~W4)가 resolution commit(71fd0f02) 을 통해 전부 해소됐다. `auth.service.spec.ts` 에 4개 이메일 변경 메서드 총 16개 케이스, `sessions.service.spec.ts` 에 `reauthenticate` 3케이스, `users.service.spec.ts` 에 `emailTakenByOther` 3케이스, `mail.service.spec.ts` 에 신규 2개 메서드 6케이스가 추가되어 서비스 레이어 핵심 경로가 양호하게 커버된다. SHA-256 round-trip, clearPendingEmailChange 롤백, logger.warn best-effort, XSS 이스케이프 등 중요한 세부 동작도 검증된다. 남은 미커버 영역은 모두 INFO 수준으로: `isUniqueEmailViolation` driverError 분기, `verify/page.tsx` 프론트엔드 테스트 부재, `profile-info-card.tsx` pendingEmail 조건부 렌더링, `change-email.test.tsx` cancel/에러 케이스, e2e resend/race 시나리오가 해당된다. 단위 테스트 7228+4515+191 전체 통과가 확인됐고 e2e 는 인프라(Docker 디스크) 문제로 실행 불가 상태다.

## 위험도

LOW

STATUS=success ISSUES=7 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/testing.md RESET_HINT=
