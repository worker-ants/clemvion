---
title: auth §2.3 재인증 정합화 + 카탈로그 세부 코드 등재 (drift 정정)
worktree: auth-reauth-spec-accuracy-0daae3
started: 2026-07-10
owner: project-planner
spec_area: spec/5-system/1-auth.md, spec/5-system/3-error-handling.md
spec_impact:
  - spec/5-system/1-auth.md
  - spec/5-system/3-error-handling.md
---

## 배경 (후속 종결)

Manual-Trigger-param 세션 라인의 spec-sync 후속 B·C. #882(에러코드 카탈로그 SoT) 완결 당시,
재인증 세부 코드 `REAUTH_REQUIRED`/`PASSWORD_INVALID`/`TOTP_INVALID` 는 "도메인 spec 본문 미문서"
라 §1.2.1 등재에서 제외하고 후속으로 남겼다(`error-codes-catalog-sot.md §후속` line 52 + 3-error-handling
§1.2.1 주석 + Rationale). 본 작업이 그 후속이며, 동시에 §2.3 "강제 종료 재인증" 행의 **drift** 를 정정한다.

계보: `spec-draft-email-change.md` 가 §2.3 문구 정정을 `refactor-auth-reverify-unify` 로 위임했으나,
그 완료 작업이 §2.3 정정을 반영하지 않아 유실됐다. 본 작업이 이를 완결한다.

## 문제 — §2.3 재인증 서술이 구현·코퍼스 합의와 불일치

`1-auth.md §2.3` "강제 종료 재인증" 행 (현재):
> 비밀번호 재확인 필수. OAuth-only 사용자는 등록된 2FA (TOTP 또는 **WebAuthn**) 또는 **이메일 OTP** 로 대체. 두 방식 모두 등록한 사용자는 §1.4.2 의 우선순위(**WebAuthn 우선**) 를 따른다

→ **미구현 대안을 정상 서술로 과대 표기**한 drift. 실제 지원은 password OR TOTP 뿐:

| 근거 (SoT) | 재인증 실제 수단 |
| --- | --- |
| 코드 `SessionsService.verifyReauth` (`sessions.service.ts:244-291`) | password OR TOTP. 주석 L219-220: "WebAuthn 은 challenge/response step-up 이 필요해 본 동기 경로에서 미지원" |
| Rationale 1.1.B-4 (`1-auth.md:515`) | "구현은 `verifyReauth`(password OR TOTP) 재사용. WebAuthn 재인증은 현재 미지원(refactor-auth-reverify-unify 영역)" |
| `9-user-profile.md` L116/341/342/397 | 세션 강제 종료 재인증 = "비밀번호/TOTP" |
| `plan/complete/refactor-auth-reverify-unify.md` | verifyReauth = password OR TOTP |

→ §2.3 만 outlier. **정정 = 아웃라이어 행을 기존 결정(Rationale 1.1.B-4)에 정렬** — 새 결정 아님.

## 코드 검증 — 재인증 에러 코드 실제 발행처·status (ground truth)

| 코드 | status(exception) | 발행처 | 공용 |
| --- | --- | --- | --- |
| `REAUTH_REQUIRED` | 400 (`BadRequestException`, `sessions.service.ts:285`) | verifyReauth | — |
| `PASSWORD_INVALID` | 401 (`UnauthorizedException`) | verifyReauth(`sessions.service.ts:266`) **+** `AuthService.verifyPasswordForUser`(`auth.service.ts:81`) | 2FA 비활성화(`auth.controller.ts:342`)·WebAuthn 관리(`webauthn.controller.ts:372`) 재확인과 공용. **로그인 아님** |
| `TOTP_INVALID` | 401 (`UnauthorizedException`) | verifyReauth(`sessions.service.ts:279`) **+** 로그인 2FA(`auth.service.ts:452`) | 로그인 2FA 검증과 공용 |
| `REAUTH_NOT_AVAILABLE` | 403 (`ForbiddenException`, `sessions.service.ts:256`) | verifyReauth | (기등재) |

- **로그인 실패는 `LOGIN_FAILED`(401, 카탈로그 L47 기등재)** 를 반환하며 `PASSWORD_INVALID` 아님. 감사는
  `login_history` 의 `event`(`totp_failed` 등 lower_snake)·`failure_reason`(`INVALID_PASSWORD`·`TOTP_INVALID` 등 UPPER_SNAKE, §4.3 / 1-data-model §2.18.2)로 남는다.
- **`INVALID_PASSWORD`**(≠`PASSWORD_INVALID`) 는 `changePassword`(`users.service.ts:61,76/84`) **전용** — 2FA 해지 아님.
- **`PASSWORD_REQUIRED`**(401, `verifyPasswordForUser` `auth.service.ts:74`) — 비밀번호 미입력 시. 미등재(후속).

## 변경 1 — `spec/5-system/1-auth.md`

### 1a) §2.3 "강제 종료 재인증" 표 행 교체 (현 line 323)

After:
```
| 강제 종료 재인증 | `SessionsService.verifyReauth` 로 본인 확인 — 비밀번호 보유 계정은 **비밀번호 재확인**, 비밀번호 없는(2FA 보유) 계정은 등록된 **TOTP 코드**로 검증한다(둘 다 보유 시 비밀번호→TOTP 순으로 하나만 통과해도 됨). `password_hash`·2FA 모두 없는 OAuth-only 계정은 `REAUTH_NOT_AVAILABLE` 로 차단. **WebAuthn step-up·이메일 OTP 재인증은 현재 미지원**(challenge/response step-up 일반화 미착수 — Rationale 1.1.B-4·2.3.D). 이메일 변경(§1.1.B)·revoke-others 도 동일 `verifyReauth` 재사용 |
```

### 1b) §2.3 표 직후 재인증 에러 코드 note 추가 (§1.2.1 카탈로그 SoT 앵커 대상)
```
> **재인증 에러 코드** (`verifyReauth` — 강제 종료·revoke-others·이메일 변경 §1.1.B 공용): 비밀번호/TOTP 어느 자격도 미입력·미충족 → `REAUTH_REQUIRED`(400) · 비밀번호 불일치 → `PASSWORD_INVALID`(401) · TOTP 불일치 → `TOTP_INVALID`(401) · 재인증 수단 부재(OAuth-only) → `REAUTH_NOT_AVAILABLE`(403). `PASSWORD_INVALID` 는 2FA 비활성화·WebAuthn credential 관리의 비밀번호 재확인(`AuthService.verifyPasswordForUser`)과, `TOTP_INVALID` 는 로그인 2FA 검증과 **동일 코드**를 공유한다. 공용 카탈로그 등재는 [3-error-handling §1.2.1](./3-error-handling.md#121-2fa--webauthn--재인증-코드-도메인-spec-참조).
```

### 1c) §1.1.B "이메일 OTP 배제" bullet(L79) 재서술 (WARNING #3 — §2.3 정정에 따른 stale 제거)
Before:
> - **이메일 OTP 배제**: 이메일 변경 재인증은 비밀번호 또는 등록 TOTP 로 한정하며 §2.3 의 "이메일 OTP" 대체 수단은 채택하지 않는다 — 변경 대상 메일함과의 순환성 때문(Rationale 1.1.B-4). WebAuthn step-up 재인증은 §2.3 세션-revoke 와 동일하게 현재 미지원이다(Rationale 1.1.B-4).

After:
> - **이메일 OTP 배제**: 이메일 변경 재인증은 §2.3 세션 강제 종료와 동형으로 비밀번호 또는 등록 TOTP 로 한정한다(`verifyReauth` 재사용). 이메일 OTP 를 재인증 수단으로 채택하지 않는 이유는 변경 대상 메일함과의 순환성 때문이다(Rationale 1.1.B-4). WebAuthn step-up 재인증은 §2.3 와 동일하게 현재 미지원이다(Rationale 1.1.B-4).

### 1d) Rationale 1.1.B-4(L515-516) stale 문구 동기화 (WARNING #3)
- 오프닝 "§2.3 강제 종료 재인증은 OAuth-only 대안으로 "이메일 OTP" 를 언급하지만" →
  "§2.3 강제 종료 재인증은 (당초 서술상) OAuth-only 대안으로 "이메일 OTP" 를 언급했으나 이는 미구현 서술이었고 이후 §2.3.D 로 password OR TOTP 로 정정됐다. 이메일 *변경* 흐름에서는" 으로 (역사 보존 + 현행 반영).
- 말미 "§2.3 의 세션-revoke 재인증 정의 자체는 본 작업에서 변경하지 않는다." →
  "§2.3 세션-revoke 재인증 정의는 본 작업(이메일 변경)에서는 손대지 않았고, 그 정합화는 후속 §2.3.D 가 수행한다." 로.

### 1e) Rationale 신규 §2.3.D 추가 (INFO #2 — 결정이 속한 문서에 적재; 현 line 690↔692 사이)
```
### 2.3.D — §2.3 재인증 흐름 정합화 (구현·1.1.B-4 정렬)

§2.3 "강제 종료 재인증" 행은 당초 "OAuth-only 는 TOTP/WebAuthn 또는 이메일 OTP 로 대체, §1.4.2 우선순위(WebAuthn 우선)" 로 서술됐으나, 실제 구현(`SessionsService.verifyReauth`)·Rationale 1.1.B-4·`9-user-profile.md`(비밀번호/TOTP)·`refactor-auth-reverify-unify` 는 일관되게 **password OR TOTP** 만 지원한다. WebAuthn step-up 재인증은 challenge/response 흐름이 필요해 현재 미지원이며(1.1.B-4), 이메일 OTP 는 코드에 없다. 따라서 §2.3 행을 실제 지원 수단으로 정정하고 WebAuthn·이메일 OTP 는 "현재 미지원" 으로 명시한다 — 새 결정이 아니라 아웃라이어 서술을 이미 확정된 1.1.B-4 에 정렬한 것이다. 이 정정으로 §2.3 이 재인증 세부 코드(`REAUTH_REQUIRED`=400·`PASSWORD_INVALID`=401·`TOTP_INVALID`=401)의 SoT 가 되어 카탈로그 [3-error-handling §1.2.1] 등재 전제를 충족한다.
```

## 변경 2 — `spec/5-system/3-error-handling.md`

### 2a) §1.2.1 표에 3행 추가 (REAUTH_NOT_AVAILABLE 행 다음)
```
| `REAUTH_REQUIRED` | 400 | 재인증 자격증명 미입력·미충족(비밀번호/TOTP 어느 것도 검증 불가) | [1-auth.md §2.3](./1-auth.md#23-세션-정책) |
| `PASSWORD_INVALID` | 401 | 비밀번호 재확인 불일치 — 재인증(§2.3 `verifyReauth`)·2FA 비활성화/WebAuthn 관리 재확인(`verifyPasswordForUser`) 공용 | [1-auth.md §2.3](./1-auth.md#23-세션-정책) |
| `TOTP_INVALID` | 401 | TOTP 코드 불일치 — 재인증(§2.3)·로그인 2FA 공용 | [1-auth.md §2.3](./1-auth.md#23-세션-정책) |
```

### 2b) §1.2.1 하단 주석 교체 (status 오기 + totp_failed 부정확 + 근접명명 정정)
After:
> 위 표는 도메인 spec(`1-auth.md`) 본문에 문서화된 코드만 등재한다. 로그인 실패 자체는 `LOGIN_FAILED`(§1.2) API 코드로 반환되며(`PASSWORD_INVALID` 아님), 감사는 `login_history` 의 `event`(`totp_failed` 등 lower_snake)·`failure_reason`(`TOTP_INVALID`·`INVALID_PASSWORD` 등 UPPER_SNAKE 사유값, §4.3 / 1-data-model §2.18.2)로 남는다. 재인증(§2.3 `verifyReauth`) 세부 코드 `REAUTH_REQUIRED`(400)·`PASSWORD_INVALID`(401)·`TOTP_INVALID`(401)는 §2.3 문서화 완료로 위 표에 등재했다 — `PASSWORD_INVALID` 는 2FA 비활성화·WebAuthn 관리 재확인(`verifyPasswordForUser`)과, `TOTP_INVALID` 는 로그인 2FA 와 동일 코드다. **근접 명명 주의**: `PASSWORD_INVALID`(재인증·재확인)는 비밀번호 *변경* 실패 코드 `INVALID_PASSWORD`(`users.service.ts changePassword`, §1.3 별도 등재 예정)와 **다른 코드**다. 아직 도메인 spec 본문 미문서인 `INVALID_PASSWORD`(비밀번호 변경)·`NOT_A_MEMBER`(워크스페이스 멤버십)·`PASSWORD_REQUIRED`(`verifyPasswordForUser` 비밀번호 미입력)는 "spec 문서화 → 등재" 순서의 후속으로 남긴다.

### 2c) Rationale 신규 bullet (기존 완결성 bullet 유지, 후속 종결 문서화)
```
- **§2.3 재인증 흐름 정합화 + 세부 코드 등재 (drift 정정, 위 완결성 bullet 후속)**: `1-auth.md §2.3` "강제 종료 재인증" 행이 구현(`verifyReauth`=password OR TOTP)·Rationale 1.1.B-4·`9-user-profile.md` 코퍼스 합의와 달리 "WebAuthn/이메일 OTP 대체 + §1.4.2 우선순위" 로 과대 서술(미구현 대안)돼 있어, 실제 지원(password OR TOTP)으로 정렬하고 WebAuthn·이메일 OTP 재인증을 "현재 미지원(1.1.B-4)" 으로 명시했다(§2.3.D). 이로써 §2.3 이 재인증 세부 코드의 SoT 가 되어 위 완결성 bullet 이 "후속으로 남긴" 3코드를 등재했다. #882 §1.2.1 주석의 status 오기(REAUTH_REQUIRED 403→400·PASSWORD_INVALID 400→401)와 "로그인 TOTP 실패는 별도 code 없이 totp_failed 로만" 서술도 코드 기준으로 정정. `PASSWORD_INVALID`(재인증/2FA·WebAuthn 관리)는 비밀번호 변경 코드 `INVALID_PASSWORD` 와 별개임을 명시.
```

## 변경 3 — `plan/in-progress/error-codes-catalog-sot.md` 후속 체크박스 갱신 (plan_coherence WARNING)
- §후속 line 52 "[ ] 재인증(§2.3) 흐름 코드 spec 문서화 → 등재 ... (403)·(400)·(401)" 을
  `[x]` 로 갱신 + status 정정 표기(400/401/401) + "auth-reauth-spec-accuracy PR 로 완결" 명시.

## 워크플로 (project-planner)

- [x] consistency-check --spec (1차 10_11_30) — naming_collision **BLOCK:YES**(draft 산문 PASSWORD_INVALID/INVALID_PASSWORD 오귀속 2 CRITICAL) → 코드검증값으로 전면 정정. 나머지 4 checker BLOCK:NO
- [x] consistency-check 재확인 (10_33_54, 정정 draft) — **BLOCK:NO** (naming CRITICAL 해소·LOW, rationale_continuity NONE "모범적 drift 정정"). WARNING 1(event vs failure_reason 혼동)·INFO 1(dead pointer)도 spec 반영 시 정정. plan_coherence FS-flakiness 재실행 확인
- [x] spec 반영 (변경 1·2·3) + **spec-link-integrity 11/11 PASS** (§1.2.1 역링크 `#121-2fa--webauthn--재인증-코드-도메인-spec-참조`·§2.3.D `#23d--23-재인증-흐름-정합화-구현11b-4-정렬` 실측 일치)
- [ ] plan complete 이동

## 범위 밖 (별도)

- A) expression §7.1/§8.4.2 자동완성 표에 `$sourceItem`/`$dataSource` 행 — 별 PR(다른 도메인).
- `INVALID_PASSWORD`·`NOT_A_MEMBER`·`PASSWORD_REQUIRED` 카탈로그 등재 — 도메인 spec 문서화 선행, 별 후속.
- WebAuthn/이메일 OTP 재인증 실제 구현 — `refactor-auth-reverify-unify` 영역(미지원 유지).
- `task_10ac843b`(§2.3 3자 불일치) 는 본 작업이 실질 해소.
