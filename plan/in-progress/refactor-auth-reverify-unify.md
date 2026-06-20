---
worktree: refactor-auth-reverify-unify
started: 2026-06-20
owner: developer
spec_area: spec/5-system/1-auth.md, spec/data-flow/2-auth.md
parent: plan/in-progress/refactor/02-architecture.md (C-3 §3 후속)
---

# C-3 §3 후속 — 비밀번호 재확인 단일진실: webauthn/sessions raw bcrypt 통합

> C-3(#658 머지)이 disable2fa 를 `AuthService.verifyPasswordForUser` 로 이관. impl-done/ai-review 가 잔여 raw bcrypt 2곳 발견 → 본 작업으로 통합. behavior-preserving·spec 무변.

## 현황·설계 (전수 확인 2026-06-20)

| 위치 | 현황 | 처리 |
| --- | --- | --- |
| `webauthn.controller.ts:373-388` `webauthnRegenerateRecovery` | disable2fa 와 **정확히 동일** 패턴·에러코드(`PASSWORD_REQUIRED`/`PASSWORD_INVALID`)·raw bcrypt. **controller 라 같은 레이어 침범** | `verifyPasswordForUser` **drop-in**. bcrypt·usersService import·생성자 의존 제거(타 사용처 0) |
| `sessions.service.ts:246` reauth helper | raw `bcrypt.compare` — **단 계약이 다름**(친근체 "않아요" 메시지·REAUTH 다중요소·PASSWORD_REQUIRED 없음[상류 `REAUTH_NOT_AVAILABLE`]). service-layer 라 침범 아님 | `verifyPasswordForUser` **부적합** → raw `bcrypt.compare`→`comparePassword`(C-3/login 통일 헬퍼)만 일치화. 메시지·흐름 불변 |

## impl-prep (동등 분석)

C-3 와 동일 패턴·spec 무변(D). webauthn 은 data-flow/2-auth §1.2(bcrypt=Service) 정합. sessions 는 비교 primitive 만 헬퍼화(동작 동일). full impl-prep 갈음, push-enforced ai-review·impl-done 정식 수행.

## 변경

1. **webauthn.controller**: regenerate 검증 블록(13줄) → `await this.authService.verifyPasswordForUser(user.sub, dto.password)`. `import * as bcrypt`·`UsersService` import·생성자 `usersService` 제거.
2. **webauthn.controller.spec**: 생성자 인자에서 usersService 제거 + UsersService import 제거 + **`webauthnRegenerateRecovery` 테스트 신설**(현재 무커버 — authService.verifyPasswordForUser mock resolve→regenerate 성공, reject→throw).
3. **sessions.service**: line 246 `bcrypt.compare`→`comparePassword` + `comparePassword` import + `bcrypt` import 제거(타 사용처 0).

## 체크리스트

- [x] 현황·설계·spec 정합 확인 (impl-prep 동등)
- [x] 테스트 — webauthn regenerateRecovery 신설 + (sessions 무변경, 기존 통과)
- [x] 구현 (webauthn drop-in+의존제거 / sessions comparePassword)
- [x] TEST WORKFLOW (lint·unit·build·e2e) — lint·unit(7153+40 affected)·build·e2e(205) 전원 PASS
- [ ] `/ai-review --range origin/main..HEAD` + Critical/Warning 0
- [ ] `/consistency-check --impl-done spec/5-system/1-auth` BLOCK:NO

## 범위 밖 / 후속
- 2FA disable·webauthn regenerate brute-force 보호(별도 보안, behavior-change) — C-3 후속과 동일.
- spec 문서(planner): data-flow/2-auth §1.2 verifyPasswordForUser 흐름 + error-codes 등재.
