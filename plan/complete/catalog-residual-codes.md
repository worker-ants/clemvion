---
title: 카탈로그 완결성 잔여 3코드 등재 — NOT_A_MEMBER·INVALID_PASSWORD·PASSWORD_REQUIRED
worktree: catalog-residual-codes-9f2a1c
started: 2026-07-10
owner: project-planner
spec_area: spec/5-system/1-auth.md, spec/5-system/3-error-handling.md
spec_impact:
  - spec/5-system/1-auth.md
  - spec/5-system/3-error-handling.md
---

## 배경

#882 카탈로그 완결성 pass + #887(auth §2.3 재인증, origin/main squash `318642003`)이 "spec 문서화 → 등재"
후속으로 남긴 3코드를 완결한다. #887 §1.2.1 주석·`error-codes-catalog-sot.md §후속`이 이 3코드를 deferred 로 지목.

**base**: origin/main(#887·#888 머지 완료 + #889~#892). 초기 스택 base(#887 로컬 브랜치)가 이미 머지돼
stale 였던 것을 `reset --hard origin/main` 으로 교정(plan_coherence WARNING#1 해소).

## 코드 ground truth (status = exception 타입, 전수 검증)

| 코드 | status | 발행처 | 등재 섹션 | 도메인 SoT |
| --- | --- | --- | --- | --- |
| `NOT_A_MEMBER` | 403 (`ForbiddenException`) | `auth.service.ts:1134`·`workspaces.service.ts:553,729` | §1.2 (authz) | `1-auth.md §5`·`data-flow/12-workspace §1.5` |
| `INVALID_PASSWORD` | 401 (`UnauthorizedException`) | `users.service.ts:76,84`(`changePassword`) | §1.2 (auth) | `1-auth.md §2.3` body note (1b 신규) |
| `PASSWORD_REQUIRED` | 401 (`UnauthorizedException`) | `auth.service.ts:74`(`verifyPasswordForUser`) | **§1.2.1** (형제 `PASSWORD_INVALID` 와 동일 섹션) | `1-auth.md §5` |

**핵심 배치 결정 (rationale_continuity CRITICAL 반영)**: `PASSWORD_REQUIRED` 는 `verifyPasswordForUser`
(2FA 비활성화·WebAuthn 관리 재확인)의 *missing* 케이스이고, 그 *mismatch* 케이스 `PASSWORD_INVALID` 는
#887 이 **§1.2.1** 에 등재했다. 같은 함수의 두 실패 모드를 다른 섹션으로 쪼개지 않도록 `PASSWORD_REQUIRED`
도 **§1.2.1**(2FA/WebAuthn 관리 코드)에 등재한다. 반면 `INVALID_PASSWORD`(users.service `changePassword`)·
`NOT_A_MEMBER`(workspace)는 verifyPasswordForUser·재인증과 무관한 일반 auth/authz 코드라 §1.2.

- **4중 근접명명 disambiguation**: `INVALID_PASSWORD`(변경, users.service) ≠ `PASSWORD_INVALID`(재인증·2FA/WebAuthn 재확인 mismatch, §1.2.1) ≠ `PASSWORD_REQUIRED`(2FA/WebAuthn 재확인 missing, §1.2.1) ≠ `REAUTH_REQUIRED`(재인증 missing, §1.2.1, `verifyReauth`, 400). `INVALID_PASSWORD` 는 `login_history.failure_reason` 감사값으로도 쓰이나 changePassword 의 API 코드이기도.

## 변경 1 — `spec/5-system/1-auth.md` (PASSWORD_REQUIRED 신규 문서화)

### 1a) §5 API 표 직후 note 추가 (민감 동작 비밀번호 재확인 — PASSWORD_REQUIRED SoT)
```
> **민감 동작 비밀번호 재확인 코드**: 2FA 비활성화(`/api/auth/2fa/disable`)·WebAuthn 복구 코드 재발급(`/api/auth/2fa/webauthn/recovery-codes/regenerate`) 등 민감 동작의 비밀번호 재확인은 `AuthService.verifyPasswordForUser` 를 재사용한다 — 비밀번호 미설정(OAuth-only)·미입력 → `PASSWORD_REQUIRED`(401), 불일치 → `PASSWORD_INVALID`(401). 세션-revoke·이메일 변경 재인증(`verifyReauth`, §2.3, missing→`REAUTH_REQUIRED` 400)과는 **별도 헬퍼**이며 status·코드가 다르다. 공용 카탈로그는 [3-error-handling §1.2.1](./3-error-handling.md#121-2fa--webauthn--재인증-코드-도메인-spec-참조).
```

### 1b) §2.3 **본문** note 추가 — INVALID_PASSWORD (change-password) 정식 문서화 (body-level, reauth 코드 note L334 선례 대칭)
- **§2.3.C(Rationale)가 아니라 §2.3 본문**에 문서화한다 — 게이트는 "본문(body) 문서화" 를 요구하고, 기존 SoT 링크·#887 reauth 코드 게이트(L334 body blockquote)가 모두 본문을 가리키기 때문. §2.3 재인증 코드 note(L334) 바로 뒤에 companion blockquote 추가:
```
> **비밀번호 변경 실패 코드**: `POST /users/me/change-password` 의 현재 비밀번호 재확인 실패(미설정 OAuth-only·불일치)는 `INVALID_PASSWORD`(401, `users.service.changePassword`)를 반환한다 — 재인증 `PASSWORD_INVALID`(위 재인증 note)·`login_history.failure_reason` 동명 감사값과 **별개 wire 코드**다.
```
- 카탈로그 SoT 앵커: **§2.3**(`#23-세션-정책`, body — reauth 코드와 동일 앵커). §2.3.C(Rationale) 아님. 이로써 3코드 모두 본문 문서화(NOT_A_MEMBER §5·PASSWORD_REQUIRED §5·INVALID_PASSWORD §2.3) → 게이트 충족.

## 변경 2 — `spec/5-system/3-error-handling.md`

### 2a) §1.2 인증/인가 에러 표에 2행 추가 (`ACCOUNT_LOCKED` 행 다음)
`코드 | 이름 | 설명 | HTTP` (도메인 cross-ref 는 설명 열 inline — `TOKEN_INVALID` 행 선례):
```
| `NOT_A_MEMBER` | 워크스페이스 비멤버 | 대상 워크스페이스 멤버십 검증 실패 (전환 `/api/auth/workspaces/:id/switch`·탈퇴·멤버십 확인 경로, `auth.service`·`workspaces.service`) ([1-auth.md §5](./1-auth.md#5-api-엔드포인트) · [data-flow §1.5](../data-flow/12-workspace.md#15-워크스페이스-전환-토큰-재발급)) | 403 |
| `INVALID_PASSWORD` | 비밀번호 재확인 실패 | `POST /users/me/change-password` 현재 비밀번호 미설정·불일치 ([1-auth.md §2.3](./1-auth.md#23-세션-정책)). 재인증 코드 `PASSWORD_INVALID`(§1.2.1)·`login_history.failure_reason` 동명값과 별개 | 401 |
```

### 2b) §1.2.1 표에 PASSWORD_REQUIRED 1행 추가 (`PASSWORD_INVALID` 행 다음)
`코드 | status | 설명 | 도메인 SoT`:
```
| `PASSWORD_REQUIRED` | 401 | 2FA 비활성화·WebAuthn 관리 등 민감 동작의 `verifyPasswordForUser` 비밀번호 재확인에서 비밀번호 미설정(OAuth-only)·미입력. 불일치는 형제 코드 `PASSWORD_INVALID`(위). 재인증 missing `REAUTH_REQUIRED`(400, `verifyReauth`)와는 발행 헬퍼·status 다른 별개 | [1-auth.md §5](./1-auth.md#5-api-엔드포인트) |
```

### 2c) §1.2.1 하단 주석 갱신 — deferred 3코드 해소
- 현재 말미: "아직 도메인 spec 본문 미문서인 `INVALID_PASSWORD`(비밀번호 변경)·`NOT_A_MEMBER`(워크스페이스 멤버십)·`PASSWORD_REQUIRED`(`verifyPasswordForUser` 비밀번호 미입력)는 "spec 문서화 → 등재" 순서의 후속으로 남긴다."
- → "`PASSWORD_REQUIRED`(`verifyPasswordForUser` missing)는 형제 `PASSWORD_INVALID` 와 같은 위 표에 등재했고, `NOT_A_MEMBER`(워크스페이스 멤버십, 403)·`INVALID_PASSWORD`(비밀번호 변경, 401)는 §1.2 에 등재했다(도메인 SoT: `1-auth.md`). 완결성 pass 잔여 0."
- 중간 "`INVALID_PASSWORD`(..., §1.3 별도 등재 예정)" → "§1.2 등재" 정정(§1.3 아님).

### 2d) Rationale 신규 bullet (완결성 pass 종결)
```
- **§1 카탈로그 완결성 종결 — #882/#887 deferred 잔여 등재**: #882·#887 이 "spec 문서화 → 등재" 후속으로 남긴 `NOT_A_MEMBER`(403)·`INVALID_PASSWORD`(401)·`PASSWORD_REQUIRED`(401)를 등재했다. `PASSWORD_REQUIRED` 는 `verifyPasswordForUser` 의 missing 케이스라 그 mismatch 형제 `PASSWORD_INVALID` 와 동일 §1.2.1 에, `NOT_A_MEMBER`·`INVALID_PASSWORD` 는 §1.2 에 배치(둘 다 401/403 auth 코드로 §1.2 의 401/403/423 구조에 부합 — §1.3 유효성 400/404/409/422 아님). `PASSWORD_REQUIRED` 는 `§5` note 로·`INVALID_PASSWORD` 는 `§2.3` **본문** note 로 코드·status 정식 문서화(둘 다 body-level — "본문 문서화 → 등재" 게이트 충족, reauth 코드 L334 note 선례 대칭), `NOT_A_MEMBER` 는 기존 `§5` 본문 참조. 4중 근접명명(`INVALID_PASSWORD`≠`PASSWORD_INVALID`≠`PASSWORD_REQUIRED`≠`REAUTH_REQUIRED`)은 각 설명에 명시 구분. **범위 한정**: workspace 직접-추가 경로 코드(`ALREADY_A_MEMBER` 등)는 #882/#887 deferred 목록 밖이라 본 완결성 pass 범위 아님.
```

## 워크플로 (project-planner)
- [x] base 교정 `reset --hard origin/main` (#887·#888 이미 머지 — stale 스택 해소, plan_coherence WARNING#1)
- [x] consistency-check --spec — 4라운드 수렴 후 **BLOCK:NO**(15_38_35). rationale_continuity 가 매 라운드 gate 를 정밀화(형제분리→ALREADY_A_MEMBER cross-ref→gate passing-mention→body-vs-Rationale), FS-flakiness 로 summary 가 CRITICAL 반복 누락 → journal/단독 재실행 복구. 최종 3코드 본문 문서화(NOT_A_MEMBER §5·PASSWORD_REQUIRED §5 note·INVALID_PASSWORD §2.3 body note)로 게이트 충족
- [x] spec 반영 (1a §5 note·1b §2.3 note·2a §1.2 2행·2b §1.2.1 PASSWORD_REQUIRED·2c §1.2.1 주석·2d Rationale) + **spec-link-integrity 11/11 PASS**
- [x] `error-codes-catalog-sot.md §후속` L56 체크박스 갱신 (3코드 흡수 명시). 그 plan 자신의 complete 이동은 defer(설계 리스트 stale·spec_impact 부재 = #882 구조 정리 몫)
- [x] plan complete 이동 (커밋 84d9a4f15 spec 반영 → 본 chore(plan))

## 범위 밖
- WebAuthn/이메일 OTP 재인증 실제 구현 — 미착수(별도 plan).
- workspace 직접-추가 경로 코드(`ALREADY_A_MEMBER`·`WORKSPACE_TYPE_MISMATCH` 등, `workspaces.service.ts`, UPPER_SNAKE) 카탈로그 등재 — #882/#887 deferred 목록 밖, 별도 완결성 pass.
