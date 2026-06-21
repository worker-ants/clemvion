# 요구사항(Requirement) 리뷰

## 발견사항

### [INFO] 기능 완전성 — 이메일 변경 4개 엔드포인트 모두 구현 완료
- 위치: `auth.service.ts` (requestEmailChange / verifyEmailChange / resendEmailChange / cancelEmailChange), `users.controller.ts`
- 상세: spec §1.1.B 가 요구하는 4가지 엔드포인트(`request`, `verify`, `resend`, `cancel`)가 모두 구현되어 있다. 재인증 → 토큰 발급 → 확인 → 세션 revoke + 재발급 흐름이 spec 시퀀스와 일치한다.
- 제안: 해당 없음.

---

### [INFO] 기능 완전성 — spec 요구 에러 코드 완전 일치
- 위치: `auth.service.ts`
- 상세: spec §1.1.B 운영 시나리오 표의 에러 코드가 구현과 정확히 일치한다.
  - 신규 이메일 = 현재 이메일·형식 오류: 400 `VALIDATION_ERROR` (DTO `@IsEmail` + 서비스 내 비교)
  - 신규 이메일 타 계정 사용 중: 409 `RESOURCE_CONFLICT`
  - OAuth-only 무2FA: 403 `REAUTH_NOT_AVAILABLE`
  - 토큰 만료·무효: 400 `VALIDATION_ERROR`
  - verify 시 신규 이메일 선점: 409 `RESOURCE_CONFLICT` + pending NULL화 (L887, L904-908)
- 제안: 해당 없음.

---

### [INFO] spec fidelity — 감사 기록 `user.email_changed` 구현 확인
- 위치: `users.controller.ts` L250-257
- 상세: spec §4.1 표는 `user.email_changed` 를 controller 경계에서 기록하도록 요구한다. 구현은 `auditLogsService.record({ action: AUDIT_ACTIONS.USER_EMAIL_CHANGED, ... })` 를 `verifyEmailChange` 직후에 호출한다. spec Rationale 1.1.B-6 "details 에 raw 이메일 미저장" 도 준수(`details` 필드 없음, `ipAddress`만 포함). `workspaceId` 는 `payload.workspaceId` 에서 가져오며, spec §4.1 Rationale 4.1.B 의 "인증된 세션 workspaceId 귀속" 요건과 일치한다.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — login_history `session_revoked`(bulk, `familyId=null`) 기록 확인
- 위치: `sessions.service.ts` L160-168 (revokeAllFamilies)
- 상세: spec §2.3 표 "이메일 변경 시 처리" 는 `login_history` 에 `session_revoked`(bulk, `familyId=null`) 1건을 기록하도록 요구한다. `revokeAllFamilies` 내부에서 `loginHistory.record({ event: 'session_revoked', familyId: null })` 가 이미 호출되므로 spec 요건 충족.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — 토큰 SHA-256 at-rest, raw 는 메일로만 전달
- 위치: `auth.service.ts` L832-836 (requestEmailChange)
- 상세: spec §1.1 표 "토큰 at-rest 저장" 및 §1.1.B "SHA-256 해시로만 저장" 요건이 구현에 정확히 반영되어 있다. `rawToken = uuidv4()`, DB에는 `this.hashToken(rawToken)` (SHA-256 해시)만 저장하고, rawToken은 메일 링크로만 전달한다.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — 확인 성공 시 email_verified=true + pending 정리
- 위치: `auth.service.ts` L896-902 (verifyEmailChange)
- 상세: spec §6.1 표 `POST /api/users/me/email-change/verify` 는 "email 교체 + email_verified=true + 전 세션 revoke + 현재 디바이스 재발급" 을 요구한다. 구현은 `{ email: newEmail, emailVerified: true, pendingEmail: null, emailChangeToken: null, emailChangeExpiresAt: null }` 으로 update 해 모든 필드를 정확히 처리한다.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — 옛 이메일 통지 best-effort(실패 swallow) 구현
- 위치: `auth.service.ts` L930-944 (verifyEmailChange)
- 상세: spec §1.1.B "확인 완료 후 옛 이메일 통지는 best-effort(실패 swallow)" 와 일치한다. 구현은 `try/catch` 로 감싸고, 실패 시 `logger.warn` 을 남기고 예외를 삼킨다. 단, W7 resolution 에서 추가된 `logger.warn` 은 spec 이 명시한 "실패 swallow" 의 의미를 위반하지 않으며, 운영자 관측 가능성을 높이는 개선이다.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — `cancel` 멱등 동작 (pending 없어도 no-op)
- 위치: `auth.service.ts` L972-975 (cancelEmailChange), `clearPendingEmailChange` L977-983
- 상세: spec §1.1.B "email-change/cancel 은 pending 이 없어도 멱등(no-op)" 요건이 충족된다. `clearPendingEmailChange` 는 `usersService.update(userId, { pendingEmail: null, emailChangeToken: null, emailChangeExpiresAt: null })` 를 무조건 호출하며, pending 이 이미 null 이어도 오류 없이 동작한다.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — resend 시 pending 없으면 400 VALIDATION_ERROR
- 위치: `auth.service.ts` L952-959 (resendEmailChange)
- 상세: spec §6.1 표 `POST /api/users/me/email-change/resend` "pending 없으면 400 VALIDATION_ERROR" 가 구현과 일치한다. `if (!user || !user.pendingEmail)` 체크 후 `BadRequestException({ code: 'VALIDATION_ERROR' })` 를 던진다.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — `emailTakenByOther` LOWER 비교 (대소문자 무시)
- 위치: `users.service.ts` L108-113 (emailTakenByOther)
- 상세: spec §1.1.B "신규 이메일이 타 계정 사용 중 → 409" 검증 시 대소문자 무시가 spec 에 명시적으로 언급되지는 않으나, 기존 `isEmailTaken` 패턴과 동일하게 LOWER 비교를 적용해 일관성을 유지하고 있다. 본인(`excludeUserId`) 제외 조건도 적절하다. 테스트도 W3 resolution 으로 추가됨.
- 제안: 해당 없음.

---

### [INFO] spec fidelity — `requestEmailChange` 메일 발송 실패 rollback
- 위치: `auth.service.ts` L839-854 (requestEmailChange)
- 상세: W6/W9 resolution 에서 추가된 코드다. spec §1.1.B 는 메일 발송 실패 시 롤백 동작을 명시적으로 서술하지 않는다. 구현은 발송 실패 시 `clearPendingEmailChange` 로 pending 필드를 rollback 한 후 예외를 rethrow 한다. 이 동작은 spec 침묵 영역의 방어적 개선이며, DB 잔류 없이 깨끗한 상태를 유지한다. spec 이 명시한 "항상 0~1개 유효" 원칙(§1.1.B 94행)과도 부합한다.
- 제안: [SPEC-DRIFT] "메일 발송 실패 시 pending 롤백" 은 코드가 올바른 방어적 개선이며 spec 본문에 반영되지 않은 추가 명세다. spec/5-system/1-auth.md §1.1.B 운영 시나리오 표 또는 본문에 "확인 메일 발송 실패 시 pending 3필드 NULL(롤백) 후 오류 전파" 한 줄을 추가 권장(코드 유지 + spec 반영, project-planner 위임).

---

### [INFO] spec fidelity — 이메일 변경 확인 링크 URL 경로
- 위치: `mail.service.ts` L274
- 상세: 메일 발송 시 확인 링크 URL 은 `${frontendUrl}/profile/change-email/verify?token=...` 이다. spec §9-user-profile.md L110 의 `/profile/change-email` 경로와 일치하며, verify sub-page 경로는 spec 에 명시적 선언은 없으나 테스트(mail.service.spec.ts W4)에서 `/profile/change-email/verify?token=...` 로 검증한다.
- 제안: 해당 없음.

---

### [INFO] 엣지 케이스 — `verifyEmailChange` user null 가드 복합 조건
- 위치: `auth.service.ts` L868-875 (verifyEmailChange)
- 상세: 6개 조건이 단일 `if` 에 병합되어 `user` null 일 때 subsequent 조건(`user.pendingEmail`, etc.)은 short-circuit 으로 안전하게 처리된다. 그러나 `!user` 가 true 인 경우 에러 코드는 `VALIDATION_ERROR` (400)으로 던진다 — user 미존재는 `UNAUTHENTICATED` (401)이 더 정확할 수 있지만, JWT 인증 후 세션 내에서만 이 코드에 도달하므로 user가 없다는 것은 race condition 이며 기능상 문제는 없다. spec 은 에러 코드를 `VALIDATION_ERROR` / `RESOURCE_CONFLICT` 두 가지만 명시하며 user 미존재 특수 케이스에 대한 에러 코드를 규정하지 않는다 — 현행 수용 가능.
- 제안: 해당 없음 (spec 침묵 영역).

---

### [WARNING] [SPEC-DRIFT] resendEmailChange 메일 발송 실패 시 rollback 미적용 — 비대칭
- 위치: `auth.service.ts` L960-969 (resendEmailChange)
- 상세: `requestEmailChange` (W6 resolution)에서는 메일 발송 실패 시 `clearPendingEmailChange` rollback 이 추가됐다. 그러나 `resendEmailChange` 는 메일 발송 실패 시 동일한 rollback 이 적용되지 않는다 — 새 토큰으로 DB 갱신이 완료됐으나 메일이 발송되지 않은 상태로 1시간 동안 유효한 "불용 토큰" 이 남는다. 기능적으로는 사용자가 resend 를 다시 호출하면 되므로 blocking 은 아니지만, `requestEmailChange` 와의 비대칭이 생긴다. spec §1.1.B 에는 resend 메일 발송 실패 시 동작이 명시되어 있지 않으므로 코드가 틀렸다고 단정할 수 없다. 그러나 concurrency reviewer 도 이 비대칭을 "INFO — 현재 구현이 올바르다" 로 판단했다 (resend 재시도로 복구 가능). resend 실패 시 rollback 하면 오히려 pending_email 도 함께 제거되어 사용자가 처음부터 다시 request 해야 하는 더 나쁜 UX 가 된다.
- 판단: 코드가 합리적으로 의도적이다 (rollback 하면 더 나쁨). [SPEC-DRIFT] — spec 이 resend 실패 시 동작을 명시하지 않았고 구현 선택이 합리적이다. spec/5-system/1-auth.md §1.1.B 에 "resend 메일 발송 실패 시 토큰은 갱신 유지, 사용자가 재시도" 내용 보완 권장.
- 제안: 코드 유지 + spec 반영 (project-planner 위임). spec/5-system/1-auth.md §1.1.B, resend 동작 설명에 메일 발송 실패 처리 한 줄 추가.

---

### [INFO] 데이터 유효성 — `@MaxLength(128)` 토큰 검증 추가 (INFO#2 resolution)
- 위치: `email-change-verify.dto.ts` (파일 5)
- 상세: `token` 필드에 `@MaxLength(128)` 을 추가해 DoS 벡터를 방어한다. SHA-256 hex (64자) 대비 여유가 있고, 향후 토큰 알고리즘 변경에 유연하다. spec 에 MaxLength 명세는 없으나 방어적 추가이다.
- 제안: 해당 없음.

---

### [INFO] TODO/FIXME 주석 검토
- 위치: 변경된 모든 파일
- 상세: 변경 코드 내 미완성을 시사하는 TODO, FIXME, HACK, XXX 주석가 존재하지 않는다. 주석은 모두 설계 근거·경계 조건 설명·spec 참조 형태다.
- 제안: 해당 없음.

---

### [INFO] 반환값 — 모든 경로 적절한 반환
- 위치: `auth.service.ts` (verifyEmailChange L862, requestEmailChange L801, resendEmailChange L952, cancelEmailChange L972)
- 상세: `verifyEmailChange` 는 `{ accessToken, refreshToken }` 반환, `requestEmailChange`/`resendEmailChange`/`cancelEmailChange` 는 `void` 반환. 에러 경로는 모두 예외를 throw 한다. 반환값 누락 경로 없음.
- 제안: 해당 없음.

---

## 요약

이번 변경셋은 spec §1.1.B 이메일 변경 흐름 전체를 충실히 구현한다. 재인증(비밀번호/TOTP, OAuth-only 차단), 토큰 SHA-256 at-rest, 확인 시 email 교체 + email_verified=true + 전 세션 revoke + 재발급, 감사 `user.email_changed`(raw 이메일 details 미저장), `login_history session_revoked` 기록, 옛 이메일 best-effort 통지, cancel 멱등성, resend 중복검사가 모두 spec 과 line-level 로 일치한다. 에러 코드(400 VALIDATION_ERROR, 409 RESOURCE_CONFLICT, 403 REAUTH_NOT_AVAILABLE)도 spec §1.1.B 운영 시나리오 표와 정확히 대응한다. 이전 리뷰(18_29_37)의 W1~W10 resolution 이 모두 반영되었고, 해당 테스트(W1-W4)도 추가 확인되었다. 주목할 미흡 사항은 `resendEmailChange` 의 메일 발송 실패 시 동작이 `requestEmailChange` 와 비대칭이나, 이는 의도적이고 합리적인 선택이며 spec 명세 부재 영역이다(SPEC-DRIFT). 전반적으로 요구사항 충족도가 높고 차단 이슈가 없다.

## 위험도

LOW

STATUS=success ISSUES=2 PATH=/Volumes/project/private/clemvion/.claude/worktrees/spec-email-change-0fcba4/review/code/2026/06/21/20_21_02/requirement.md RESET_HINT=
