---
worktree: spec-email-change-0fcba4
started: 2026-06-21
owner: developer
spec_area: spec/5-system/1-auth.md, spec/2-navigation/9-user-profile.md
parent: plan/in-progress/spec-draft-email-change.md
---

# 이메일 변경 프로세스 구현

> spec 반영 커밋 074ed014 위에 구현. 한 PR(브랜치 claude/spec-email-change-0fcba4)로 마무리.

## 설계 메모 (코드 조사 2026-06-21)
- 재사용: `AuthService.hashToken`(private SHA-256), `generateTokens`(private), `verifyPasswordForUser`(public, password), `SessionsService.verifyReauth`(private, password OR TOTP — **WebAuthn 미지원**), `revokeAllFamilies`(public), `MailService` 템플릿 패턴.
- **email-change 오케스트레이션은 AuthService 에 배치** (private hashToken/generateTokens + mailService/usersService/sessionsService/dataSource 보유). controller(UsersController)는 이미 AuthService(forwardRef) 주입.
- **재인증 = password OR TOTP** (SessionsService 에 public `reauthenticate(userId, {password?,totpCode?})` 추가해 verifyReauth 래핑). **WebAuthn-only(무password·무TOTP) 는 REAUTH_NOT_AVAILABLE** — 이는 기존 세션 강제종료 reauth 와 동일 한계(verifyReauth 가 WebAuthn 미지원). spec §1.1.B "등록 2FA(TOTP·WebAuthn)" 중 WebAuthn reauth 는 별도 challenge 흐름 필요 → 본 PR 범위 밖, follow-up 으로 분리(아래).
- verify 세션 처리 = `revokeAllFamilies` + `generateTokens`(rotateSessionAfterPasswordChange 와 동일 2-step, 이름 오해 피해 직접 호출).
- 중복검사 대소문자 무시: UsersService 에 `emailTakenByOther(email, excludeId)` 추가.

## 체크리스트
- [x] 3. `/consistency-check --impl-prep spec/5-system/` BLOCK:NO (17_44_53)
- [x] 4. DOCUMENTATION — user-guide(password-and-sessions.{mdx,en.mdx}) + i18n ko/en + swagger jsdoc. WebAuthn reauth 는 spec narrow 로 해소(partial 분리 불요)
- [ ] 5/6/7. 테스트 선작성 + 구현
  - backend: migration V100, User entity +3, AUDIT_ACTIONS +USER_EMAIL_CHANGED, DTO(email-change-request/verify), UserProfileDto +pendingEmail, MailService +2, SessionsService +reauthenticate, AuthService +4 메서드, UsersController +4 endpoint + getMe pendingEmail, users.module(MailModule import 확인)
  - frontend: /profile/change-email page + /verify landing, profile-info-card CTA+pending, lib/api/users.ts +4, i18n ko/en, UserProfile 타입 +pendingEmail
- [x] 5/6/7. 구현 + 테스트 (backend 12파일 + frontend 8파일 + e2e/unit 테스트)
- [x] 8. TEST WORKFLOW — lint PASS / unit PASS / build PASS / e2e PASS (entity DataTypeNotSupported 1건 → type:'varchar' 명시로 수정)
- [ ] 9. REVIEW WORKFLOW (/ai-review → resolution → /consistency-check --impl-done)

## 설계 변경 노트
- WebAuthn-as-reauth: spec §1.1.B 를 password/TOTP 로 **narrow** (verifyReauth 재사용, §2.3 세션-revoke 와 동일 한계 — WebAuthn step-up 일반화는 refactor-auth-reverify-unify 영역). spec==impl 이라 별도 follow-up plan 불요.
- spec status sync: user.email_changed 를 Planned→구현 으로 3 SoT(1-auth §4.1, audit-actions §3, data-flow/1-audit §1.1) 동기화.
