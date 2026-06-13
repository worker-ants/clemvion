# Requirement Review — audit-user-actions (2026-06-13 09:43:18)

## 발견사항

### [INFO] `spec/5-system/1-auth.md` §4.1 구현 표 — `user.*` 행 셀이 장문으로 기존 패턴과 불일치
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/5-system/1-auth.md` line 362
- 상세: 구현 표의 다른 행(Integration, 워크스페이스, 실행, 설정)은 action 명칭만 기재하는 반면, 추가된 `인증 (워크스페이스 컨텍스트)` 행은 귀속 정책·controller 경로·링크를 셀 내에 장문으로 담고 있다. 기능적 오류는 없으며 내용도 spec Rationale 4.1.B와 일치한다. 표 가독성 저하 수준.
- 제안: 셀 내 설명을 `§Rationale 4.1.B` 링크로 위임하고 간결화 (선택, 기능 무관).

### [INFO] `spec/data-flow/1-audit.md` Rationale 단락 — "4개 모듈 13개 call site" 구 표현 잔존
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/audit-user-actions-5a037b/spec/data-flow/1-audit.md` Rationale 섹션 "모든 도메인 service 가 호출하는 cross-cutting concern" 단락
- 상세: 이번 변경 세트의 diff(`spec/data-flow/1-audit.md`)를 보면 해당 Rationale 단락은 "실제 writer 는 한정된 위치(워크스페이스 도메인 service + `user.*` 인증 controller)뿐이라 폐기했다 — 정확한 호출자·call site 전수는 §1.1 표가 SoT 다"로 갱신되어 구 숫자 표현을 제거했다. 그러나 RESOLUTION.md (INFO 처리 #2/15)는 이를 "Fixed"로 표기하고 있어 해당 변경이 이번 PR에 포함됐음을 확인. 워크트리의 실제 파일에서 Rationale 단락이 올바르게 갱신된 것을 확인했다.
- 제안: 이미 처리됨. 추가 조치 불필요.

---

## 기능 완전성 평가

**구현 완전성: 충족**

`spec/5-system/1-auth.md §4.1` + `§Rationale 4.1.B` + `spec/data-flow/1-audit.md §1.1` 이 정의한 3가지 `user.*` audit 액션 구현 상태:

1. `user.password_changed` — `users/users.controller.ts:changePassword` (L162-168). 비밀번호 해시 후 성공 경로에만 기록. 실패(비밀번호 불일치 UnauthorizedException) 전에는 기록하지 않음. 테스트 확인.
2. `user.2fa_enabled` (TOTP) — `auth/auth.controller.ts:verify2fa` (L312-319). `details.method='totp'`. 테스트 확인.
3. `user.2fa_disabled` (TOTP) — `auth/auth.controller.ts:disable2fa` (L358-365). 비밀번호 재확인 실패 시 미기록. 테스트 확인.
4. `user.2fa_enabled` (WebAuthn) — `auth/webauthn/webauthn.controller.ts:webauthnRegisterVerify` (L150-161). `details.method='webauthn'`·`credentialId`·`firstCredential`. 테스트 확인.
5. `user.2fa_disabled` (WebAuthn) — `auth/webauthn/webauthn.controller.ts:webauthnDelete` (L344-355). `details.method='webauthn'`·`credentialId`·`remainingCredentials`. 테스트 확인.

**spec 필드명 일치 점검 (spec §4.1 / Rationale 4.1.B 기준)**:
- `workspaceId`: spec "액터의 현재 세션 `workspaceId`" → 코드 `user.workspaceId` / `payload.workspaceId`. 일치.
- `userId`: spec "userId" → 코드 `user.sub` / `payload.sub`. 일치 (`sub` = userId).
- `resourceType`: spec `resourceType: 'user'` → 코드 `resourceType: 'user'`. 일치.
- `resourceId`: spec `resourceId: <userId>` → 코드 `resourceId: user.sub`. 일치.
- action 문자열: spec `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` → `AUDIT_ACTIONS` const 값 `'user.password_changed'`, `'user.2fa_enabled'`, `'user.2fa_disabled'`. 일치.

**spec 제외 사항 준수**:
- 무인증 `POST /auth/reset-password` 경로에 감사 기록 없음 (spec §Rationale 4.1.B 명시). 구현 미존재로 올바름.
- `audit_log.workspaceId` non-nullable 제약을 schema 변경 없이 충족 — `JwtPayload.workspaceId: string` (non-optional) 타입 강제로 null 불가.

**엣지 케이스 처리**:
- 비밀번호 불일치 → `user.password_changed` 미기록 (테스트 커버됨: `users.controller.spec.ts`).
- `disable2fa` 비밀번호 불일치 → `user.2fa_disabled` 미기록 (테스트 커버됨: `auth.controller.spec.ts`).
- `verify2fa` TOTP 코드 불일치 throw → `user.2fa_enabled` 미기록 (테스트 커버됨: `auth.controller.spec.ts` — RESOLUTION.md Warning#3 Fixed 후 추가).
- `webauthnRegisterVerify` throw → `user.2fa_enabled` 미기록 (테스트 커버됨: `webauthn.controller.spec.ts` — RESOLUTION.md Warning#2 Fixed 후 추가).
- `webauthnDelete` throw → `user.2fa_disabled` 미기록 (테스트 커버됨: `webauthn.controller.spec.ts` — RESOLUTION.md Warning#2 Fixed 후 추가).
- `AuditLogsService.record` 실패 swallow — spec `data-flow/1-audit.md` §Overview 계약 ("두 `record` 모두 실패를 삼킨다"). 구현 주석에도 명시.
- `webauthnDelete`는 HTTP 204 No Content — `remaining` 값은 audit details에만 사용되고 HTTP 응답 body로 노출되지 않음. 올바름.

**module 배선 완전성**:
- `UsersModule`에 `AuditLogsModule` import 완료 (`users.module.ts`).
- `AuthModule`에 `AuditLogsModule` import 완료 (`auth.module.ts`) — `WebAuthnController`는 `AuthModule.controllers`에 포함되어 DI 정상.
- `WebAuthnController` 생성자 5번째 파라미터 `auditLogsService` 추가, 테스트도 동일하게 수정됨.

**TODO/FIXME**: 없음.

**spec fidelity (line-level)**:
- `spec/5-system/1-auth.md §4.1`: `user.*` 3건이 구현 표로 이동, Planned 표에서 제거 (diff line 362 추가·line 369 삭제). 코드와 일치.
- `spec/data-flow/1-audit.md §1.1`: 5개 call site 행 추가 (users controller·auth controller·webauthn controller 경로), 커버리지 갭 텍스트에서 `user.*`를 구현됨으로 전환. 코드와 일치.
- `spec/data-flow/1-audit.md` Rationale: "4개 모듈 13개 call site" 구 표현 제거, "§1.1 표가 SoT" 방식으로 갱신. 완전히 처리됨.
- `audit-action.const.ts`: `USER_PASSWORD_CHANGED: 'user.password_changed'`, `USER_2FA_ENABLED: 'user.2fa_enabled'`, `USER_2FA_DISABLED: 'user.2fa_disabled'` 추가. spec action 명칭과 완전 일치.

---

## 요약

이번 변경은 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 3가지 audit 액션을 `spec/5-system/1-auth.md §4.1` + `§Rationale 4.1.B` + `spec/data-flow/1-audit.md §1.1` 이 정의한 대로 controller 경계에서 액터 세션 `workspaceId`에 귀속해 완전히 구현했다. TOTP·WebAuthn 두 경로 모두 커버하고, 실패 경로(비밀번호 불일치·TOTP 코드 오류·서비스 throw)에서 감사 기록을 남기지 않는 올바른 동작을 단위 테스트로 보장한다. spec 필드명(`workspaceId`, `userId`, `resourceType: 'user'`, `resourceId: userId`, action 문자열) 모두 코드 구현과 line-level 일치한다. 무인증 password-reset 경로 제외도 준수됐다. spec 반영(`§4.1` 구현 표·`data-flow §1.1` 표·Rationale Stale 수정)도 이번 변경 세트에 완전히 포함됐다. Critical/Warning 수준 요구사항 결함 없음. INFO 1건(구현 표 셀 장문)은 가독성 수준이며 기능에 영향 없다.

## 위험도

NONE

STATUS: SUCCESS
