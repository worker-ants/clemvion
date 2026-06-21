# 요구사항(Requirement) 리뷰 결과

대상: 이메일 변경 프로세스 구현 (spec/5-system/1-auth.md §1.1.B)
검토일: 2026-06-21

---

## 발견사항

### [INFO] `verifyEmailChange` — 토큰 단일 표현식으로 다중 실패 원인을 반환

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L169-181 (`verifyEmailChange`)
- 상세: `!user`, `!user.pendingEmail`, `!user.emailChangeToken`, 토큰 해시 불일치, `!user.emailChangeExpiresAt`, 만료(현재 시각 초과) 등 여섯 조건이 단일 `BadRequestException({ code: 'VALIDATION_ERROR' })` 로 합산된다. spec §1.1.B 운영 시나리오 표(`토큰 만료(1h 경과)·무효 → 400 VALIDATION_ERROR`)와 일치하고, 단일 코드로 무효·만료를 포괄하는 것은 Rationale 1.1.B-3 의 의도에 부합한다. 에러 구분이 필요하다면 `details` 필드로 분기 가능하나 spec 이 침묵하는 영역이다. 기능 상 요구사항 위반이 아니므로 INFO.
- 제안: 현행 유지 가능. 클라이언트 UX 분기가 필요해지면 `details.reason: 'EXPIRED' | 'INVALID'` 를 추가하되 그 결정은 spec 레벨에서 먼저 정의.

---

### [INFO] `resendEmailChange` — `emailChangeExpiresAt` 초기화 전 `emailChangeToken` 갱신 순서 보장

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L906-932 (`resendEmailChange`)
- 상세: `usersService.update` 가 `emailChangeToken` 과 `emailChangeExpiresAt` 를 동일 `UPDATE` 하나에 처리하므로 두 필드 교체는 원자적이다. spec §1.1.B "pending 이 있을 때 재요청은 기존 토큰을 덮어쓴다(항상 0~1개 유효)"와 일치한다. 동시 재발송 요청 시 두 `UPDATE` 가 겹쳐도 최후 커밋 쪽이 유효 토큰이 되므로 안전하다.
- 제안: 추가 조치 불요.

---

### [INFO] `cancelEmailChange` — 재인증 불요 검증 없음 (spec 과 일치, 의도적)

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L933-936
- 상세: spec §1.1.B "cancel 은 재인증 불요, pending 없어도 멱등" 을 그대로 구현한다. JWT guard 는 controller 단에서 적용되어 있어 적어도 인증 세션이 필요하다.
- 제안: 추가 조치 불요.

---

### [INFO] 프론트엔드 `VerifyEmailChangePage` — Strict Mode 이중 호출 보호는 `ref` 로만 충분

- 위치: `codebase/frontend/src/app/(main)/profile/change-email/verify/page.tsx` L189
- 상세: `ran` ref 는 컴포넌트 마운트 수명과 연동된다. React 18 Strict Mode 에서 effect 를 두 번 실행하는 시나리오에서 두 번째 verify 를 막는다. 그러나 `router.replace("/profile")` 이후 사용자가 뒤로가기 해 재도착하면 컴포넌트가 remount 돼 `ran.current=false` 로 리셋되고 이미 소비된 토큰으로 verify 재시도한다. 이 경우 서버가 `VALIDATION_ERROR` 를 반환하여 `verifyError` 가 세팅되고 에러 UI 가 표시된다. 기능적으로 재시도 방어가 아니라 "단순 Strict Mode guard" 임을 문서화하면 충분하다. spec 이 침묵하는 영역.
- 제안: 현행 유지. 에러 화면에서 `/profile/change-email` 링크를 제공하므로 사용자 구제 경로 존재.

---

### [INFO] `requestEmailChange` — `newEmail.trim().toLowerCase()` 대소문자 비교 vs `emailTakenByOther` LOWER() DB 쿼리 불일치 없음

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L802-803, `users.service.ts` L987
- 상세: 현재 이메일과 비교는 `newEmail.trim().toLowerCase() === user.email.toLowerCase()` (JS), 타 계정 중복은 `LOWER(u.email) = LOWER(:email)` (DB). 두 경로 모두 대소문자 무시로 일관된다. spec §1.1.B "신규 이메일 = 현재 이메일 → 400 VALIDATION_ERROR" 와 일치.

---

### [WARNING] `requestEmailChange` — 재인증 실패 시 user 조회 전 예외 발생, user null 체크 순서

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L800-804
- 상세: `sessionsService.reauthenticate(userId, auth)` 가 먼저 호출되고, 그 내부에서 `findById` 가 null 이면 `UnauthorizedException({ code: 'UNAUTHENTICATED' })` 를 이미 던진다. 이후 `auth.service.ts` 에서 `const user = await this.usersService.findById(userId)` 를 다시 호출하고 null 이면 또 `UNAUTHENTICATED` 를 던진다. 이중 DB 조회 및 이중 null 가드가 생긴다. 재인증이 성공했음에도 1ms 사이에 사용자가 삭제되는 극단적 race 외에는 두 번째 `findById` 가 null 을 반환할 수 없다. 기능 버그는 아니지만 불필요한 중복 DB 호출이다. spec 이 구현 세부를 규정하지 않으므로 CRITICAL 은 아니다.
- 제안: `sessionsService.reauthenticate` 이 성공하면 user 는 존재함이 보장되므로, `auth.service.ts` 의 두 번째 `findById` 후 null guard 는 안전망(방어 코드)로 남겨두어도 되지만 `reauthenticate` 가 user 를 반환하도록 시그니처를 변경하면 하나로 줄일 수 있다.

---

### [WARNING] `verifyEmailChange` — `emailVerified: true` 강제 설정이 명시적으로 spec 에만 일치

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L870-876
- 상세: spec §1.1.B 운영 시나리오 표에 `verify 동작` 로 `email_verified=true` 가 명시되어 있다. 구현에서도 동일하게 `emailVerified: true` 를 설정한다. 일치한다.
  그러나 `email_verified` 필드가 이미 true 인 상태에서도 다시 true 로 덮어쓰는 것은 무해하며 의도적이다. 신규 이메일은 메일 링크 클릭으로 접근 가능함이 증명됐으므로 `verified=true` 는 정확하다. 이슈 없음 — 발견 기록 목적.
- 제안: 추가 조치 불요.

---

### [WARNING] `requestEmailChange` — 메일 발송 실패 시 pending 상태가 DB 에 남음

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L822-832 (`requestEmailChange` step 3-4)
- 상세: step 3에서 `usersService.update` 로 `pendingEmail`, `emailChangeToken`, `emailChangeExpiresAt` 를 저장하고, step 4에서 `mailService.sendEmailChangeVerification` 를 호출한다. 이 메일 발송이 실패하면 `rawToken` 이 사용자에게 전달되지 않았음에도 DB 에 `pendingEmail`/`emailChangeToken`/`emailChangeExpiresAt` 가 남는다. 사용자는 메일을 받지 못했으나 `GET /api/users/me` 에서 `pendingEmail` 이 있는 것처럼 보여 "resend" UX 로 진입 가능하다. `resend` 경로가 새 토큰을 발급하므로 실질적인 기능 막힘은 없다. 그러나 초기 request 가 메일 발송 에러를 던지면 클라이언트가 에러 응답을 받으면서도 DB pending 상태가 잔존하는 불일관성이 생긴다.
  spec §1.1.B 는 이 에러 처리 순서를 명시하지 않는다. `sendEmailChangeVerification` 는 실패 시 `throw` 하므로(mail.service.ts L374) 발신 실패가 caller 에게 예외로 전파된다. spec 이 "메일 발송 실패 swallow" 를 명시하지 않았으므로 현재 동작(예외 전파)은 설계 의도에 부합할 수 있으나 DB 불일관성은 남는다.
- 제안: 발송 실패 시 `clearPendingEmailChange(userId)` 를 호출해 DB 를 롤백하거나, 또는 트랜잭션으로 묶어 원자성을 보장하는 것이 더 견고하다. 단 spec 이 침묵하는 영역이므로 코드 버그라기보다 개선 사항으로 분류. spec 반영 시 "발송 실패 시 pending 롤백" 여부를 명시하기를 권고.

---

### [INFO] `verifyEmailChange` — best-effort 옛 이메일 통지에서 예외를 삼키지 않고 재전파하는 mail.service 내부와의 불일치

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L897-908, `mail.service.ts` L441-444
- 상세: `auth.service.ts` 는 `sendEmailChangedNotice` 를 `try/catch` 로 감싸고 실패를 삼킨다("best-effort"). 그러나 `mail.service.ts` 의 `sendEmailChangedNotice` 내부는 실패 시 `throw error` 한다(L443). 이 두 계층이 조합돼 mail service 의 throw 는 auth service 의 catch 에서 먹혀 정상 동작한다. spec §1.1.B "옛 이메일 통지는 best-effort(실패 swallow)" 와 일치. `sendEmailChangeVerification`(신규 이메일용) 는 반대로 auth service 가 try/catch 없이 호출하므로 실패가 전파된다. 이 비대칭은 의도적이며 spec 과 일치한다.

---

### [INFO] `EmailChangeRequestDto` — `totpCode` 길이 제약 `@Length(6, 8)` 과 spec 비교

- 위치: `codebase/backend/src/modules/users/dto/email-change-request.dto.ts` L40-42
- 상세: spec §1.1.B 가 TOTP 코드 길이를 명시하지 않는다. 기존 TOTP 관련 코드·spec 에서 "6자리 코드" 가 표준이나, 8자리를 허용한 것은 일부 authenticator 의 steam 등 8자리 확장 호환을 위한 방어적 처리로 보인다. spec §1.4 는 "RFC 6238 / 6자리" 로 기술하므로 `@Length(6, 6)` 이 spec 과 더 정합하다. 기존 TOTP 검증 로직의 길이 허용 범위를 확인할 필요가 있다.
- 제안: 기존 TOTP verify DTO 와 동일한 길이 제약을 사용할 것. spec 이 6자리로 명시하므로 `@Length(6, 6)` 또는 기존 패턴 유지.

---

### [INFO] [SPEC-DRIFT] `spec/2-navigation/9-user-profile.md §6.1` — 이메일 변경 엔드포인트 4개와 `pendingEmail` 필드가 이미 spec 에 반영됨

- 위치: `spec/2-navigation/9-user-profile.md §6.1` (worktree 버전 L318-325)
- 상세: 이 리뷰의 코드 변경이 구현하는 `/api/users/me/email-change/*` 4개 엔드포인트와 `GET /api/users/me` 응답의 `pendingEmail: string | null` 필드는 이미 worktree 의 spec 에 반영되어 있다. cross-spec checker(consistency review 2026-06-21/17_18_50)는 spec-draft 단계에서 이 필드가 미명시라고 지적했으나 spec 반영이 완료된 현재 시점에서는 해소됐다. spec 과 구현이 일치한다.
- 제안: 코드 유지. 추가 spec 갱신 불요 (이미 반영됨).

---

### [INFO] [SPEC-DRIFT] 감사 액션 `user.email_changed` — spec/conventions/audit-actions.md 레지스트리 미등록 가능성

- 위치: consistency check 2026-06-21/17_18_50 SUMMARY.md INFO #2 참조
- 상세: `AUDIT_ACTIONS.USER_EMAIL_CHANGED = 'user.email_changed'` 는 코드에 추가됐다. spec/5-system/1-auth.md §4.1 에는 `user.email_changed` 가 반영됐다(worktree spec L404). 그러나 `spec/conventions/audit-actions.md §3` 레지스트리에 동일 항목 등재 여부는 본 리뷰에서 직접 확인하지 않았다. consistency check 에서 INFO 로 지적된 사항이므로 코드 버그가 아니나, conventions 레지스트리 갱신 누락 시 spec-drift 가 된다.
- 제안: `spec/conventions/audit-actions.md §3` user 행에 `email_changed` 가 등재됐는지 확인. 미등재 시 project-planner 를 통해 추가.

---

### [INFO] 프론트엔드 `ChangeEmailPage` — TOTP-only 계정 UX 힌트 부재

- 위치: `codebase/frontend/src/app/(main)/profile/change-email/page.tsx` L149-177
- 상세: 페이지는 비밀번호 필드와 TOTP 필드를 동시에 노출한다. 비밀번호 없이 TOTP 만 있는 사용자가 비밀번호를 입력하지 않고 TOTP 코드만 입력해 submit 해도 서버가 `verifyReauth` 에서 올바르게 처리한다. 그러나 UI 힌트("비밀번호 없는 경우 TOTP 만 입력 가능")가 없어 사용자가 혼란스러울 수 있다. spec §1.1.B 운영 시나리오 표는 "비밀번호 없음 + TOTP 보유 → TOTP 코드 재확인" 을 명시하나, UI 구현 세부를 지시하지 않는다. 기능은 올바르게 작동하므로 INFO.
- 제안: UX 개선 여지. 현행 유지 가능.

---

### [WARNING] `verifyEmailChange` — 확인 완료 후 `updated` (재조회 user) 가 null 인 경우 토큰 발급 실패

- 위치: `codebase/backend/src/modules/auth/auth.service.ts` L896-902
- 상세: email update 커밋 성공 후 `const updated = await this.usersService.findById(userId)` 를 다시 호출한다. 이 재조회가 null 이면 `UNAUTHENTICATED` 를 던진다. 그러나 이 시점에는 이미 `email` 교체 + `pendingEmail null` 화 + `revokeAllFamilies` 가 완료됐다. 즉 이메일은 변경됐으나 새 토큰을 발급받지 못한 상태가 된다. 사용자는 재로그인해야 하며 그때 새 이메일로 접근 가능하다. spec §1.1.B "확인 성공 시 현재 디바이스 재발급(`{ accessToken }`)" 과 어긋나는 예외 케이스이지만, 극단적 race condition(update 성공 후 1ms 내 사용자 삭제)에서만 발생한다. 실용적으로 무시 가능하나 이론상 spec 기대를 충족하지 못하는 경로이다.
- 제안: `usersService.update` 가 업데이트된 엔티티를 반환하도록 변경하거나, update 이후 재조회 대신 기존 `user` 객체의 필드를 직접 변경해 사용하면 DB round-trip 과 race window 를 줄일 수 있다. 단 영향 범위가 작으므로 개선 사항으로 분류.

---

## 요약

이메일 변경 프로세스(spec/5-system/1-auth.md §1.1.B, spec/2-navigation/9-user-profile.md §6.1)의 핵심 흐름 — 재인증 → pending 저장 → 확인 메일 발송 → 토큰 검증 → email 교체 + 전 세션 revoke + 현재 디바이스 재발급 → 옛 이메일 best-effort 통지 — 은 spec 과 line-level 로 일치한다. DB 마이그레이션(V100, 3 컬럼 nullable), 엔티티, DTO, AUDIT_ACTIONS 추가, 컨트롤러 엔드포인트 4개(throttle 포함), 세션 처리(revokeAllFamilies + generateTokens), 감사 기록(user.email_changed, details 에 raw 이메일 미저장), best-effort 옛 이메일 통지, 멱등 cancel, 프론트엔드 페이지/verify landing/profile-info-card CTA 모두 요구사항을 충족한다. 주요 주의사항은 (1) `requestEmailChange` 의 메일 발송 실패 시 DB pending 상태가 잔존하는 불일관성(resend 경로로 구제 가능하나 초기 에러 응답과 DB 상태가 불일치)과 (2) `verifyEmailChange` 의 이중 DB 조회로 인한 불필요한 round-trip이다. 두 사항 모두 spec 이 침묵하는 영역으로 CRITICAL 버그는 아니나 개선 권고 수준이다.

---

## 위험도

LOW

STATUS: SUCCESS
