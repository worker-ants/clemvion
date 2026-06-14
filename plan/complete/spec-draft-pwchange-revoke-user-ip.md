---
worktree: audit-user-actions-5a037b
started: 2026-06-13
owner: planner
status: implemented
spec_impact:
  - spec/5-system/1-auth.md
  - spec/2-navigation/9-user-profile.md
  - spec/data-flow/1-audit.md
---

# Spec draft — 비밀번호 변경 시 세션 revoke (A-1) + user.* 감사 ipAddress (B-1)

> **완료 (확인 2026-06-14, m-cleanup)**: A-1(변경 1~3 auth spec·변경 4 user-profile)·B-1(변경 5~6 audit)
> 모든 spec 변경 + 구현(UsersController.changePassword → rotateSessionAfterPasswordChange → revokeAllFamilies,
> PasswordChangeResultDto accessToken 재발급, user.* 감사 ipAddress 동반)이 PR #578(commit 386c812a, 2026-06-13)에서
> 반영 완료. 잔여 [ ] 0건.

## 배경

refactor 04 후속. 사용자 결정(2026-06-13):
- **A-1 = 옵션 B**: 비밀번호 변경 성공 시 **사용자의 모든 활성 family 를 revoke + 현재 디바이스에 새 세션(access+refresh) 재발급**. (옵션 a 전 세션 revoke·옵션 b' 현재 family 제외 revoke 는 기각 — refresh 쿠키 Path `/api/auth` 한정 때문에 `/users/me/change-password` 에서 현재 family 식별 불가하고, 전체 회전이 가장 안전.)
- **B-1**: user.* 감사 이벤트에 `ipAddress` 동반.

대상 spec: `spec/5-system/1-auth.md`, `spec/2-navigation/9-user-profile.md`, `spec/data-flow/1-audit.md`.

> **consistency-check 22_13_35 반영**: data-flow/1-audit.md 는 `code:` frontmatter 가 없는 frontmatter-evidence **비대상** 폴더(구현 현황을 표로 추적) — B-1 의 data-flow 편집은 frontmatter 부여 불요(SUMMARY Warning b 채택). active worktree 겹침 INFO 는 본 작업이 `claude/audit-user-actions` **당사자 브랜치**이므로 동일 worktree 연속 커밋으로 흡수(병합 충돌 무관). §1.2 session_revoked 동기화·위협모델 대조 INFO 는 아래 변경에 반영.

## A-1. `spec/5-system/1-auth.md`

### 변경 1 — §2.3 세션 정책 표에 행 추가 ("강제 종료 재인증" 행 아래)

```
| 비밀번호 변경 시 처리 | 비밀번호 변경(`POST /users/me/change-password`) 성공 시 사용자의 **모든 활성 family 를 revoke** 하고 변경을 수행한 **현재 디바이스에 새 세션(access token + refresh 쿠키 회전)을 즉시 재발급**한다 — 탈취 가능한 모든 refresh token(현재 family 포함)을 변경 시점에 무효화하면서 변경한 본인은 재로그인 없이 계속 사용. `login_history` 에 `session_revoked`(bulk, `familyId=null`) 1건 기록. 재발급 세션은 표준 7일(`rememberMe=false`) — 직전 세션의 remember-me 상태는 승계하지 않는다(현재 family 미식별, Rationale 2.3.C) — Rationale 2.3.C |
```

### 변경 2 — §4.3 login_history `session_revoked` 행 설명 확장

기존:
```
| session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료 |
```
변경:
```
| session_revoked | 사용자가 활성 세션 목록에서 다른 family 강제 종료, 또는 **비밀번호 변경 성공 시 전체 family revoke**(bulk, `familyId=null`) |
```
(동일 의미 확장을 `spec/data-flow/1-audit.md §1.2` caller 표 주변 서술과 동기화 — 변경 6 참조.)

### 변경 3 — Rationale 신규 §2.3.C 추가 (§2.3.B 뒤)

```
### 2.3.C — 비밀번호 변경 시 세션 revoke 범위 (refactor 04 후속)

비밀번호 변경(`POST /users/me/change-password`) 성공 시 **사용자의 모든 활성 family 를 revoke 하고 현재 디바이스에 새 세션을 재발급**한다(옵션 B). 변경 직전 `currentPassword` bcrypt 검증으로 본인 확인이 끝나므로 별도 재인증은 요구하지 않는다. 응답으로 새 access token 을 반환하고 refresh 쿠키를 회전시켜, 변경한 본인은 로그아웃 없이 그대로 사용한다.

근거: 비밀번호 변경의 보안 목적은 **유출된 비밀번호로 이미 발급된(=탈취 가능한) 세션의 무효화**다. 이상적으로는 "현재 세션만 남기고 나머지 revoke"(옵션 b')이나, refresh 쿠키 Path 가 `/api/auth` 로 한정돼(§2.3 · M-5) `/api/users/me/change-password` 요청에는 쿠키가 첨부되지 않아 **현재 family 를 식별할 수단이 없다**. 따라서 전체 revoke + 재발급으로 동일 UX(현재 디바이스 유지)를 달성하되 현재 family 의 구 refresh token 까지 회전시켜 **더 강한 무효화**를 얻는다. OWASP Session Management 권고(비밀번호 변경 시 세션 무효화)와 일치한다.

reissue 세션은 표준 7일(`rememberMe=false`)로 발급한다 — 현재 family 를 식별할 수 없어 직전 세션의 remember-me(30일) 여부를 승계할 수 없기 때문이다. 변경 직후 본인이 명시적으로 수행한 동작이라 재발급 세션 수명 하향은 수용 가능한 트레이드오프다.

**무인증 reset-password(§1.1.A)와의 위협 모델 대조**: `POST /auth/reset-password`(토큰 기반·세션 없음)는 "비밀번호를 분실해 계정 통제권을 잃었을 수 있는" 시나리오라 전 세션을 revoke 하되 재발급하지 않고 로그인 화면으로 보낸다(기존 흐름 유지). 반면 change-password 는 "현재 비밀번호를 아는 본인이 능동적으로 교체" 하는 시나리오라 현재 세션 신뢰가 유지돼 재발급한다. 둘 다 "전 세션 revoke" 라는 원칙은 공유하되 재발급 여부가 갈린다.

**기각된 대안 (a) 전 세션 revoke + 재발급 없음**: 현재 디바이스 포함 전체 종료 후 재로그인 강제. 변경한 본인은 방금 비밀번호로 재인증한 신뢰 세션이라 끊을 보안 이득이 없고 재로그인 비용만 발생.
**기각된 대안 (b') 현재 family 제외 revoke**: 위 쿠키 Path 제약으로 changePassword 컨트롤러에서 현재 family 식별 불가 — 구현 불가능.

**OAuth-only 사용자**: `passwordHash` 가 없으면 `POST /users/me/change-password` 자체가 `INVALID_PASSWORD` 로 차단되므로(현행) 본 정책은 비밀번호 보유 사용자에만 적용된다.

revoke/재발급 실패가 비밀번호 변경 주 동작(이미 커밋됨)을 깨지 않도록 best-effort 로 처리하되, 실패는 서버 로그로 관측 가능해야 한다.
```

## A-1 응답 계약. `spec/2-navigation/9-user-profile.md`

### 변경 4 — change-password 응답 계약 갱신 (§2.2 비밀번호 변경 서술 + §API 표 L303)

`POST /api/users/me/change-password` 응답이 `{ data: { success: true } }` → **`{ data: { accessToken: string } }`** 로 변경. 동시에 **refresh 쿠키 회전**(`Set-Cookie`, Path `/api/auth`). 클라이언트는 응답의 새 `accessToken` 으로 in-memory access token 을 교체하고(`auth-store`/`setAccessToken`), refresh 쿠키는 브라우저가 자동 갱신. 성공 시 `/profile` 리다이렉트 흐름은 유지.

§API 표 L303 비고 보강:
```
| POST | /api/users/me/change-password | 비밀번호 변경. 성공 시 전 세션 revoke + 현재 디바이스 새 세션 재발급 — `{ accessToken }` 반환 + refresh 쿠키 회전 ([인증 §2.3 / Rationale 2.3.C](../5-system/1-auth.md#23-세션-정책)) |
```

## B-1. `spec/data-flow/1-audit.md` §1.1

### 변경 5 — user.* 행에 ipAddress 동반 표기

auth_config 계열(L59 "auth_config 계열은 모두 `ipAddress` 를 함께 전달")과 동일하게, user.* 5개 행(`user.password_changed`, `user.2fa_enabled`·`user.2fa_disabled` 의 totp·webauthn)에 `· ipAddress 동반(포렌식)` 추가. 클라이언트 IP 추출은 `extractClientIp`(`auth/utils/client-ip.ts`, `TRUST_CF_CONNECTING_IP` 정책 — [인증 spec §2.3 / Rationale 2.3.B](../5-system/1-auth.md))로 auth_config 계열과 동일 경로. 추출 불가 시 `ipAddress` 는 `undefined`(생략).

### 변경 6 — §1.1 본문 + §1.2 session_revoked 동기화

§1.1 본문 "인증(`user.password_changed`…) 액션은 구현됐다 …" 단락에 비밀번호 변경 시 **전체 family revoke + 재발급**으로 `login_history.session_revoked`(bulk) 1건이 동반 기록됨을 한 줄 보강. §1.2 caller 표(`auth/sessions.service.ts` → `session_revoked`)는 caller 불변(rotation 도 SessionsService 경유)이나, "session_revoked 트리거에 비밀번호 변경 전체 revoke 포함" 을 §1.2 주변 서술에 병기.

## Rationale (draft 자체 근거)

- A-1(옵션 B)은 사용자 결정을 spec 에 고정. 기존 §2.3 세션 정책·§4.3 login_history 분류와 정합 — `session_revoked` 의미를 "강제 종료 또는 비밀번호 변경 트리거 bulk revoke" 로 **확장**하되 enum/스키마 변경 없음. reset-password(전 세션 revoke, 재발급 없음)와의 위협 모델 차이를 §2.3.C 에 명시(consistency INFO 2 반영).
- 응답 계약 변경(변경 4)은 access token 재발급을 클라이언트에 전달하기 위한 필수 변경. `{ accessToken }` 형태는 login/verify-email/refresh 등 기존 토큰 발급 응답(`{ data: { accessToken } }`)과 동일 패턴이라 프론트 통합 비용 최소.
- B-1 은 auth_config.* 가 이미 따르는 `ipAddress` 동반 패턴의 수평 확장 — 새 결정 아님. data-flow §1.1 mermaid `record({..., ipAddress?})` 시그니처가 이미 ipAddress optional 포함.
- data-flow/1-audit.md frontmatter-evidence 비대상(위 배경 blockquote) — Warning b 채택.
