# 테스트(Testing) 리뷰 결과

대상: 이메일 변경 프로세스 구현 (spec/5-system/1-auth.md §1.1.B)
리뷰일: 2026-06-21

---

## 발견사항

### [WARNING] `AuthService` 신규 4개 메서드에 대한 단위 테스트 부재
- 위치: `codebase/backend/src/modules/auth/auth.service.spec.ts`
- 상세: `requestEmailChange`, `verifyEmailChange`, `resendEmailChange`, `cancelEmailChange` 4개 메서드가 `auth.service.ts`에 추가됐으나 `auth.service.spec.ts`에 해당 단위 테스트가 전혀 없다. e2e 테스트(`users-email-change.e2e-spec.ts`)가 통합 흐름을 검증하지만, 서비스 레이어 단위 테스트 없이는 다음 경로를 독립 검증할 수 없다:
  - `verifyEmailChange` 내 race condition 처리: `emailTakenByOther` 재검사 후 `clearPendingEmailChange` 호출 → `ConflictException` throw 경로
  - `isUniqueEmailViolation` private 메서드의 `e.code === '23505'` / `e.driverError?.code === '23505'` 분기
  - `clearPendingEmailChange` 가 `update` 에 `null` 3개 필드를 정확히 전달하는지
  - `verifyEmailChange` 에서 `sendEmailChangedNotice` 실패를 삼키고 tokens를 정상 반환하는 best-effort 경로
  - `resendEmailChange` 에서 `user.pendingEmail` 없을 때 `BadRequestException` 던지는 경로
- 제안: `auth.service.spec.ts`에 `describe('requestEmailChange / verifyEmailChange / resendEmailChange / cancelEmailChange')` 블록 추가. `UsersService`, `SessionsService`, `MailService`를 jest mock으로 주입 후 각 분기별 단위 테스트 작성.

### [WARNING] `SessionsService.reauthenticate` 단위 테스트 부재
- 위치: `codebase/backend/src/modules/auth/sessions.service.spec.ts`
- 상세: `sessions.service.ts`에 추가된 `reauthenticate(userId, auth)` public 메서드에 대한 단위 테스트가 없다. 이 메서드는 `usersService.findById` 반환 null 시 `UnauthorizedException` throw, 정상 시 `verifyReauth` 위임 두 분기를 갖는다. `verifyReauth` 가 이미 기존 테스트에서 검증되더라도 새 public wrapper의 null user 경로는 별도로 커버해야 한다.
- 제안: `sessions.service.spec.ts`에 `reauthenticate` describe 블록 추가: (1) user 없을 때 `UNAUTHENTICATED` throw, (2) user 있을 때 `verifyReauth` 위임 확인.

### [WARNING] `UsersService.emailTakenByOther` 단위 테스트 부재
- 위치: `codebase/backend/src/modules/users/users.service.spec.ts`
- 상세: `users.service.ts`에 추가된 `emailTakenByOther(email, excludeUserId)` 메서드에 대한 단위 테스트가 없다. 핵심 로직인 `LOWER(u.email) = LOWER(:email)` 대소문자 무시 쿼리와 `u.id != :id` 본인 제외 조건이 모두 테스트되지 않는다. e2e 테스트가 409 응답을 검증하지만, 쿼리빌더 파라미터 바인딩 오류는 단위 테스트로만 조기 발견 가능하다.
- 제안: Repository mock을 사용하거나 in-memory DB로 `emailTakenByOther`의 대소문자 무시(예: `NEW@X.COM` vs `new@x.com`), 본인 제외 조건을 단위 테스트로 검증.

### [WARNING] `MailService` 신규 2개 메서드에 대한 단위 테스트 부재
- 위치: `codebase/backend/src/modules/mail/mail.service.spec.ts`
- 상세: `sendEmailChangeVerification`, `sendEmailChangedNotice` 두 메서드가 추가됐으나 `mail.service.spec.ts`에 테스트가 없다. 기존 패턴에서 `escapeHtml` 적용 여부(XSS 방어), MAIL_TRANSPORT_CONSOLE 분기에서 URL 로깅 여부, mailerService 실패 시 에러 re-throw 등 검증이 필요한 경로가 있다. 특히 `buildEmailChangedNoticeHtml`에서 `safeNewEmail = this.escapeHtml(newEmail)` 를 사용하지만 `buildEmailChangedNoticeText`에서는 raw `newEmail`을 그대로 사용하는 것이 의도인지 확인이 필요하다.
- 제안: `mail.service.spec.ts`에 두 메서드 각각에 대해 (1) 정상 발송 시 `mailerService.sendMail` 호출 검증, (2) 발송 실패 시 에러 re-throw 검증, (3) `MAIL_TRANSPORT_CONSOLE` 분기 로깅 검증 추가.

### [INFO] 프론트엔드 `verify/page.tsx`에 대한 테스트 부재
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx`
- 상세: `VerifyEmailChangePage`는 `useRef(false)` 로 중복 실행을 막는 1회성 effect를 가진다. `change-email/page.tsx` 테스트(`change-email.test.tsx`)는 존재하지만, `verify/page.tsx`에 대한 테스트가 없다. 검증 경로: (1) 토큰 없을 때 `changeEmailMissingToken` 메시지 표시, (2) API 성공 시 `setAccessToken` 호출 + router.replace("/profile"), (3) API 실패 시 `verifyError` 메시지 표시.
- 제안: `verify/__tests__/verify-email-change.test.tsx`를 생성해 세 경로를 커버. Strict Mode 이중 effect 가드(`ran.current`)가 제대로 동작하는지도 테스트할 것.

### [INFO] `profile-info-card.test.tsx`에서 `pendingEmail` prop 변경에 대한 테스트 미추가
- 위치: `codebase/frontend/src/app/(main)/profile/components/__tests__/profile-info-card.test.tsx`
- 상세: `profile-info-card.tsx`에 `pendingEmail` prop이 추가되고 조건부 렌더링이 변경됐으나(`data-testid="profile-email-pending"`, `data-testid="profile-change-email-link"` 추가), `profile-info-card.test.tsx`의 `renderCard` 헬퍼가 `{ name: string; email: string }` 타입으로 고정되어 `pendingEmail` 케이스를 테스트하지 않는다. `profile.emailPendingLabel` 문자열 표시 여부와 `emailReadonlyHint` 대체 여부가 미검증 상태다.
- 제안: (1) `pendingEmail: "pending@x.com"` 일 때 `data-testid="profile-email-pending"` 렌더링 확인, (2) `pendingEmail: null` 일 때 `emailReadonlyHint` 표시 확인 케이스 추가.

### [INFO] e2e에서 `resend` 엔드포인트 미검증
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: e2e 테스트가 `request`, `verify`(성공/실패), `cancel`(멱등 포함)을 모두 커버하지만 `POST /api/users/me/email-change/resend` 는 검증하지 않는다. resend는 토큰·만료 시각을 갱신하는 사이드이펙트가 있어 e2e 레벨 검증이 유용하다 (새 토큰 해시로 교체됐는지 DB 확인).
- 제안: `users-email-change.e2e-spec.ts`에 resend 시나리오 추가: pending 상태 시드 → resend 호출 → DB에서 `email_change_token`이 이전과 달라졌는지, `email_change_expires_at`이 갱신됐는지 확인.

### [INFO] e2e에서 `verify` 시 race condition 경로(verify 시점 이메일 선점) 미검증
- 위치: `codebase/backend/test/users-email-change.e2e-spec.ts`
- 상세: `verifyEmailChange` 서비스 코드는 verify 시점에 `emailTakenByOther` 재검사 후 `ConflictException`을 던지는 경로가 있다. 이는 request와 verify 사이에 타 계정이 해당 이메일을 점유하는 race 시나리오다. e2e 테스트에서 이 409 경로가 누락되어 있다.
- 제안: "verify 시점 이메일 선점 409" 케이스 추가: user A가 request 후, user B가 동일 이메일로 등록 완료 → user A의 verify가 409 반환하는지 검증.

### [INFO] `change-email.test.tsx`에서 에러 케이스 및 cancel 동작 미검증
- 위치: `codebase/frontend/src/app/(main)/profile/change-email/__tests__/change-email.test.tsx`
- 상세: 현재 테스트는 성공 제출(request)과 pending 상태 표시 + resend 호출 두 케이스만 검증한다. 다음이 미커버:
  - `requestEmailChange` 실패 시 에러 toast 표시
  - pending 상태에서 cancel 버튼 클릭 시 `cancelEmailChange` 호출 및 UI 상태 변경
  - TOTP 코드 입력 경로(password 없이 totpCode 만 제출)
- 제안: cancel 성공 후 pending 상태 해제 UI 확인 케이스, 및 request 실패 에러 toast 케이스 추가.

### [INFO] `isUniqueEmailViolation` 분기 중 `driverError.code` 경로 미커버
- 위치: `codebase/backend/src/modules/auth/auth.service.ts` (L272-276)
- 상세: `isUniqueEmailViolation`은 `e.code === '23505'` 와 `e.driverError?.code === '23505'` 두 분기를 갖는다. `driverError` 중첩 경로는 TypeORM이 특정 버전에서 에러를 래핑하는 방식에 의존한다. 단위 테스트 없이는 이 분기가 실제 DB 에러 구조와 일치하는지 검증되지 않는다.
- 제안: `auth.service.spec.ts`에 `isUniqueEmailViolation` 단위 테스트: `{ code: '23505' }`, `{ driverError: { code: '23505' } }`, 두 필드 모두 없는 경우(false 반환) 세 케이스 검증.

---

## 요약

이번 변경은 백엔드 e2e 테스트(`users-email-change.e2e-spec.ts`)와 컨트롤러 단위 테스트(`users.controller.spec.ts` 확장), 프론트엔드 페이지 테스트(`change-email.test.tsx`)가 추가되어 핵심 흐름은 커버된다. 그러나 새로 추가된 서비스 레이어 메서드(`AuthService` 4개, `SessionsService.reauthenticate`, `UsersService.emailTakenByOther`)와 `MailService` 2개 메서드에 대한 **단위 테스트가 전무**하다. 이로 인해 race condition 처리(`isUniqueEmailViolation` 분기, verify 시점 재검사), best-effort 이메일 통지 실패 삼킴, 대소문자 무시 쿼리 정확성 등 중요한 코드 경로가 단위 레벨에서 검증되지 않는다. 프론트엔드에서는 `verify/page.tsx` 전체와 `profile-info-card.tsx`의 `pendingEmail` 조건부 렌더링이 테스트 미적용 상태다.

## 위험도

MEDIUM

STATUS: SUCCESS
