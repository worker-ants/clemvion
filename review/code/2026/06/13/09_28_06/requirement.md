# Requirement Review — audit-user-actions

## 발견사항

### **[INFO]** 중복 JSDoc 주석 — `webauthn.service.ts:deleteCredential`
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/codebase/backend/src/modules/auth/webauthn/webauthn.service.ts` line 512–517
- 상세: `deleteCredential` 에 단일 행 JSDoc(`/** 개별 삭제. ... */`)이 이미 존재하는 상태에서 새 multi-line JSDoc(`/** credential 삭제. ... */`)이 바로 이어 붙여졌다. TypeScript/JSDoc 파싱 상 "마지막 JSDoc 블록만 메서드에 귀속"되어 런타임 동작은 올바르지만, 도구(IDE·TypeDoc)가 두 주석을 혼동하거나 stale 내용을 노출할 수 있다.
- 제안: 기존 단일 행 JSDoc(`/** 개별 삭제. ... */`)을 제거하고 새 multi-line JSDoc 하나만 남긴다.

---

### **[INFO]** `data-flow/1-audit.md` 하단 Rationale 에 call site 카운트 stale 문구
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/data-flow/1-audit.md` "모든 도메인 service 가 호출하는 cross-cutting concern" 섹션 마지막 문장
- 상세: 해당 Rationale 섹션 마지막 줄에 "실제 writer 는 4개 모듈 13개 call site 뿐이라 폐기했다 (§1.1)"라고 남아 있으나, 본 PR 이후 실제 call site 는 18개(§1.1 본문 갱신)다. §1.1 본문은 "7개 위치 18개 call site"로 정확히 갱신됐으나 Rationale 문단만 아직 "13개" 를 가리키는 구 표현을 보유하고 있다.
- 제안: 해당 Rationale 마지막 문장의 "4개 모듈 13개 call site" 표현을 §1.1 갱신 내용과 일치하도록 수정한다(spec 내부 일관성 수정 — project-planner 위임).

---

## 기능 완전성 평가

**구현 완전성: 충족**

spec `1-auth §4.1` + `§Rationale 4.1.B` + `data-flow/1-audit.md §1.1` 이 정의한 3가지 `user.*` audit 액션 모두 구현됐다:

1. `user.password_changed` — `users.controller.ts:changePassword` (POST /users/me/change-password). 비밀번호 변경 성공 후, 실패(UnauthorizedException) 전에는 기록하지 않음. 테스트 확인.
2. `user.2fa_enabled` (TOTP) — `auth.controller.ts:verify2fa`. `details.method='totp'`. 테스트 확인.
3. `user.2fa_disabled` (TOTP) — `auth.controller.ts:disable2fa`. 비밀번호 재확인 실패 시 미기록. 테스트 확인.
4. `user.2fa_enabled` (WebAuthn) — `webauthn.controller.ts:webauthnRegisterVerify`. `details.method='webauthn'`·`credentialId`·`firstCredential`. 테스트 확인.
5. `user.2fa_disabled` (WebAuthn) — `webauthn.controller.ts:webauthnDelete`. `details.method='webauthn'`·`credentialId`·`remainingCredentials`. 테스트 확인.

**spec 에 명시된 제외 사항도 준수**: 무인증 password-reset(`POST /auth/reset-password`)에는 audit 기록이 없으며, `audit_log.workspaceId` non-nullable 제약을 schema 변경 없이 충족(모두 인증 세션에서 JWT `workspaceId` 사용).

**엣지 케이스 처리**:
- 비밀번호 불일치 시 `user.password_changed` 미기록 (테스트 커버됨).
- `disable2fa` 비밀번호 틀림 시 `user.2fa_disabled` 미기록 (테스트 커버됨).
- `audit_log.workspaceId` non-nullable — `JwtPayload.workspaceId: string`(non-optional)으로 타입 강제, 별도 null 가드 불필요.
- `AuditLogsService.record` 실패 swallow — 주 동작 실패 없음 보장됨.
- `webauthnDelete` 는 HTTP 204 No Content 로 응답 body 없음 — `remaining` 사용 후 반환값 없는 것이 올바름.

**module 배선 완전성**:
- `UsersModule`에 `AuditLogsModule` import 추가 완료.
- `AuthModule`에 `AuditLogsModule` import 추가 완료 (WebAuthnController 포함).
- `WebAuthnController` 는 `AuthModule.controllers` 에 등록돼 있어 `AuditLogsService` DI 정상.

**TODO/FIXME**: 없음.

**spec fidelity**: `spec/5-system/1-auth.md §4.1` 구현 표에 `user.*` 3건이 Planned→Implemented 로 이동됐고, `spec/data-flow/1-audit.md §1.1` 표도 5개 call site 행이 추가됐다. 코드 구현과 spec 본문의 필드명·action 문자열·`resourceType:'user'`·`resourceId:userId`·`details` 구조가 모두 일치한다. 단, Rationale 섹션의 "13개" 구 카운트만 stale (INFO 발견사항).

---

## 요약

이번 변경은 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 3가지 audit 액션을 spec(`1-auth §4.1 / Rationale 4.1.B`)에 따라 controller 경계에서 액터의 세션 workspaceId 에 귀속해 완전히 구현했다. TOTP·WebAuthn 두 경로를 모두 커버하고, 실패 경로(비밀번호 불일치)에서는 감사 기록을 남기지 않는 올바른 동작을 테스트로 보장한다. spec 반영도 `§4.1` 표와 `data-flow §1.1` 표 양쪽에 충실히 완료됐다. 기능·요구사항·spec fidelity 관점에서 Critical/Warning 수준 결함 없음. INFO 2건(중복 JSDoc, Rationale 구 카운트 stale)은 코드 동작에 영향 없는 사소한 문서 정리 사항이다.

---

## 위험도

NONE
