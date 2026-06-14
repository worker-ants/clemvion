---
worktree: audit-user-actions-5a037b (branch claude/audit-user-actions)
started: 2026-06-13
owner: developer
status: complete
spec_impact:
  - spec/2-navigation/9-user-profile.md
  - spec/5-system/1-auth.md
  - spec/data-flow/1-audit.md
---

# refactor 04 후속 구현 — A-1 비번변경 세션 + B-1 ipAddress + B-2 SRP + C DRY/e2e

spec: dcd225b8 (auth §2.3·Rationale 2.3.C, user-profile §2.x·API, data-flow §1.1·§1.2). 사용자 결정: A-1=옵션 B(전 세션 revoke + 현재 디바이스 재발급), A-2=별도 작업(`execution-engine-typed-errors.md`).

## 사전 일관성
- [x] `--spec` (22_23_29, BLOCK:NO) — 동일 변경 검증 완료. `--impl-prep` 는 중복이라 생략(동일 change·동일 spec 영역, fresh BLOCK:NO). 강제 게이트 `--impl-done` 은 구현 후 수행.

## 구현 체크리스트
- [x] **B-2** `UsersService.changePassword(userId, current, new)` — bcrypt 검증·강도·해시·update 이전 (controller→service)
- [x] **A-1** `SessionsService.revokeAllFamilies(userId, ctx)` — 전 family revoke + session_revoked bulk 기록
- [x] **A-1** `AuthService.rotateSessionAfterPasswordChange(userId, ctx)` — revokeAllFamilies + generateTokens. SessionsService 주입
- [x] **A-1** module forwardRef: UsersModule↔AuthModule. UsersController 에 AuthService(forwardRef)+ConfigService 주입
- [x] **A-1** `UsersController.changePassword` thin 화 — service 호출 → rotate → setRefreshTokenCookie(@Res) → audit(ipAddress) → `{ accessToken }` 반환
- [x] **A-1** `PasswordChangeResultDto` { success } → { accessToken }
- [x] **B-1** auth.controller verify2fa/disable2fa: @Req + ipAddress in record
- [x] **B-1** webauthn.controller register/verify·delete: @Req + ipAddress in record
- [x] **C-1** `auth/utils/auth-context.ts` 추출 (authContextFromRequest), auth·webauthn controller import
- [x] **A-1 FE** change-password page: 응답 accessToken → auth-store(setAccessToken). 기존 test 갱신
- [x] **C-2** e2e: audit_log DB INSERT 검증 (user.password_changed) + change-password accessToken 반환 + 세션 revoke

## 테스트 (TDD)
- [x] users.service.spec: changePassword 5 케이스
- [x] sessions.service.spec: revokeAllFamilies (revoke+record / no-op / user 없음)
- [x] auth.service.spec: rotateSessionAfterPasswordChange (+ SessionsService mock provider)
- [x] users.controller.spec: orchestration (rotate·cookie·audit ipAddress·accessToken)
- [x] auth.controller.spec: 2fa record ipAddress
- [x] webauthn.controller.spec: record ipAddress
- [x] auth-context.spec (추출 helper)

## DOCUMENTATION (step 4)
- [x] swagger jsdoc: ApiOperation(change-password 세션 회전) + PasswordChangeResultDto(accessToken) 갱신
- [x] user-guide: 당시 페이지 부재로 보류했으나 **후속 B-2(PR #579)에서 `07-workspace-and-team/password-and-sessions.{mdx,en.mdx}` (KO/EN) 신설로 해소** (아래 "후속 > 완료" 참조).

## TEST + REVIEW WORKFLOW
- [x] backend unit (6785 pass) · frontend unit (4318 pass, dist 준비 후) · backend build · backend·frontend lint (0 error)
- [x] e2e 190 pass (docker, 신규 change-password e2e 2건 포함). web-chat-sdk/packages/sdk lint·unit·build 는 worktree npm ci env 이슈 — 본 변경 무관 독립 패키지
- [x] /ai-review (22_57_48, RISK LOW · Critical 0 · Warning 4) + Warning 4건 fix(W1 순서불변식·W2 env격리·W3 e2e독립·W4 확인) + RESOLUTION.md
- [x] /consistency-check --impl-done (23_09_52, BLOCK: NO; Warning 1 + INFO 11 = 전부 기존 spec 문서 nit, 본 변경 무관 — planner follow-up)

## 후속

### 완료 (dev PR — branch claude/refactor-04-bcrypt-userguide-20c7ca)
- [x] **B-3** BCRYPT_ROUNDS 공용화 — `common/utils/password.util` 에 `hashPassword`/`comparePassword`/`BCRYPT_ROUNDS` SoT. auth.service·users.service 의 bcrypt 직접 의존 제거. (ai-review W1 comparePassword 추출 동반)
- [x] **B-2** 비밀번호 변경 user-guide 신설 — `07-workspace-and-team/password-and-sessions.{mdx,en.mdx}` (security-2fa 외 신규 페이지, KO/EN). 비번 변경 시 타 기기 세션 종료 UX.
- [x] TEST: backend build · unit 56 · e2e 190 PASS · 변경파일 lint clean.
- [x] /ai-review (23_39_46, RISK LOW · Critical 0 · Warning 4) → W1·W3 fix, W4 dismiss(false positive), W2 planner defer. RESOLUTION.md.

### 완료된 planner 트랙 (spec PR — branch claude/refactor-04-spec-audit-conventions-a3f58f, **PR #582 머지**)
- [x] **B-1** data-model §2.18 `ip_address`→`String?` (AuditLog), Rationale 4.1.B WebAuthn 추가 credential·OAuth-only TOTP 비활성 보강.
- [x] **A-2** — `workspace.transfer_ownership` 시제 규약: `spec/conventions/audit-actions.md` 신설로 해소 (§4.1 예외 명시 대안 기각). 사용자 결정 2026-06-14.
- [x] **W2 SPEC-DRIFT** (ai-review 23_39_46): `spec/2-navigation/13-user-guide.md` §2 IA 트리에 `password-and-sessions` 행 추가.
  - 추적 plan `spec-audit-actions-conventions.md` → `plan/complete/` 이동 완료.

### 별도 작업 (독립 plan 으로 추적 — 본 umbrella 의 open item 아님)
- **A-1** execution-engine typed-error 체계 — **설계 초안 완료(PR #583)**, 본구현 대기. 독립 plan `execution-engine-typed-errors.md` (in-progress) 에서 추적·진행.
