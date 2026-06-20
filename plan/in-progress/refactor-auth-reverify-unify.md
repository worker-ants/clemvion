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
3. **sessions.service**: line 246 `bcrypt.compare`→`comparePassword` + `comparePassword` import + `bcrypt` import 제거(타 사용처 0). + verifyReauth JSDoc "bcrypt 검증"→"comparePassword 헬퍼로 검증" (주석 드리프트 정정).
4. **(ai-review 18_00_58 후속)** `sessions.service.spec`: `revokeFamily` 6개 호출에 5번째 인자(`currentRefreshToken=null`) 명시 + **self-revoke 방지 분기(`400 CANNOT_REVOKE_CURRENT_SESSION`) 테스트 2건 신설**(self=차단·non-current=정상 revoke) — 기존 분기가 테스트에서 dead-path 였던 갭 해소. `webauthn.controller.spec`: 재발급 호출 인자(`user.sub`) 단언 추가 + it 설명 영문 통일. (전부 테스트·주석, 프로덕션 동작 불변)

## 체크리스트

- [x] 현황·설계·spec 정합 확인 (impl-prep 동등)
- [x] 테스트 — webauthn regenerateRecovery 신설 + (sessions 무변경, 기존 통과)
- [x] 구현 (webauthn drop-in+의존제거 / sessions comparePassword)
- [x] TEST WORKFLOW (lint·unit·build·e2e) — lint·unit(7155+40 affected)·build·e2e(205) 전원 PASS (review-fix 후 재통과)
- [x] `/ai-review --range origin/main..HEAD` + Critical/Warning 0 — 1차(18_00_58) WARNING 4 → fix → fresh(18_19_24) **Critical 0·WARNING 0**(전부 INFO). RESOLUTION.md 기록
- [x] `/consistency-check --impl-done spec/5-system/1-auth` BLOCK:NO — 1차(18_01_48)·fresh(18_19_26) 모두 **BLOCK:NO**(전부 INFO)

## 범위 밖 / 후속
- 2FA disable·webauthn regenerate brute-force 보호(별도 보안, behavior-change) — C-3 후속과 동일 (ai-review INFO#10).
- **spec 문서(planner)** — ai-review/consistency 가 발견한 SPEC-DRIFT(코드 옳음·spec 낡음, INFO 라 비차단):
  - `data-flow/2-auth.md §1.2` 에 `verifyPasswordForUser` 헬퍼·위임 경로(disable2fa/webauthn regenerate)·에러 코드 등재 + `bcrypt.compare` 직접 참조를 `comparePassword` 추상화로 갱신 (ai-review INFO#1·#3).
  - `verifyReauth` 에러 코드(`PASSWORD_INVALID`/`TOTP_INVALID`/`REAUTH_REQUIRED`) spec 본문 테이블 등재 (ai-review INFO#2).
  - `spec/5-system/3-error-handling.md §1` 에 `PASSWORD_REQUIRED`/`PASSWORD_INVALID` 카탈로그 등재(401·트리거·적용 엔드포인트) + `1-auth.md §5` regenerate 행 에러코드 보강 (consistency WARNING#1·INFO#4). 기존 동일코드 재사용이라 신규 아님.
  - `1-auth.md ## Rationale` 에 "비밀번호 재확인 AuthService 단일 귀속" 결정 등재 (consistency INFO#1).
  - `1-auth.md §2` 에 self-revoke 방지(`400 CANNOT_REVOKE_CURRENT_SESSION`) 정책 명시 + `data-flow/2-auth.md §1.5` self-revoke 주석에 `currentRefreshToken`(sha256→family 비교) 흐름 1문장 보강 (consistency fresh INFO#3·#8). 구현은 refactor-04 부터 존재, spec 본문만 미반영.
- **단일진실 완성 후보**: `auth-configs.service.ts:309` raw `bcrypt.compare`(에러코드 `AUTH_FAILED` 로 계약 상이 — user 비밀번호 재확인과 다른 의미) 처리 방향 별도 검토 (consistency naming INFO#5).
- **defer (behavior-change·범위 밖)**: ai-review WARNING#1 `verifyPasswordForUser` early-exit 타이밍 사이드채널 — 대상 `auth.service.ts` 는 본 changeset 밖(C-3 #658), 호출 경로가 JWT 인증 후 본인 비밀번호 확인이라 userId enumeration 불가(자기 계정만 조회)·실위험 ~0. dummy-compare 도입은 별도 보안 작업. ai-review INFO#6·#7·#9(미변경 메서드 pre-existing 테스트/타입 정리)도 동일하게 비차단 defer.
