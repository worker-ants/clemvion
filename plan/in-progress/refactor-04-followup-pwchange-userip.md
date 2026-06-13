---
worktree: audit-user-actions-5a037b (branch claude/audit-user-actions)
started: 2026-06-13
owner: developer
status: in-progress
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
- [ ] user-guide: 비밀번호 변경/활성 세션 흐름을 다루는 **기존 가이드 페이지 없음** (security-2fa 는 2FA 전용). 신규 페이지 생성은 추측성이라 보류 — /ai-review user-guide-sync-reviewer 판단에 위임.

## TEST + REVIEW WORKFLOW
- [x] backend unit (6785 pass) · frontend change-password (6 pass) · backend build · backend·frontend lint (0 error)
- [ ] 전체 run-test.sh lint·unit·build (web-chat-sdk/packages/sdk npm ci 환경 이슈 — 내 변경 무관 backend+frontend 는 통과) · e2e (docker)
- [ ] /ai-review + Critical/Warning fix + RESOLUTION
- [ ] /consistency-check --impl-done (강제 게이트)
