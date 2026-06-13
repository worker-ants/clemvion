# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/5-system/, diff-base=fcd1d594)

---

## 발견사항

발견된 CRITICAL 또는 WARNING 항목 없음.

### [INFO] WebAuthn credential 등록마다 `user.2fa_enabled` 기록 — spec 명시 범위 확인

- **target 위치**: `auth/webauthn/webauthn.controller.ts` `webauthnRegisterVerify()` (L144–156)
- **과거 결정 출처**: `spec/5-system/1-auth.md §4.1` / Rationale 4.1.B — `user.2fa_enabled` 는 "WebAuthn credential 등록" 을 나타낸다고 명시
- **상세**: spec §4.1 표는 `user.2fa_enabled` 의 WebAuthn 트리거를 "WebAuthn credential 등록 verify 성공 시점" 으로, `data-flow/1-audit.md §1.1` 표(row 4)도 `POST …/webauthn/register/verify` 에서 기록함을 명확히 한다. 구현은 이 결정을 정확히 따른다 — 첫 등록이든 추가 등록이든 `USER_2FA_ENABLED` 를 기록하고 `firstCredential` 플래그로 두 경우를 구별한다. 기각된 대안(첫 등록에만 기록)은 spec Rationale 에 명시적으로 기각된 바는 없으나, 현 구현이 data-flow §1.1 의 의도("credential 등록 = 2FA enabled 신호")와 일치한다. 보완할 내용: Rationale 4.1.B 또는 data-flow §1.1 에 "추가 credential 등록도 `user.2fa_enabled` 를 기록한다" 는 한 줄을 명시적으로 추가하면 향후 독자의 의도 추론이 불필요해진다.
- **제안**: spec Rationale 4.1.B 의 `user.2fa_enabled` 설명에 "첫 등록뿐 아니라 추가 credential 등록 시에도 `details.firstCredential=false` 로 기록한다" 를 한 줄 추가 (낮은 우선순위 — 현재 구현과 spec 의미가 충돌하지 않음).

---

### [INFO] `POST /auth/2fa/disable` 의 OAuth-only 사용자 처리 — Rationale 미기록 경로

- **target 위치**: `auth/auth.controller.ts` `disable2fa()` (L342–356)
- **과거 결정 출처**: `spec/5-system/1-auth.md §1.4 / Rationale 1.4.D` — WebAuthn 등록 사용자의 TOTP fallback 자동 제공 금지 결정; `§2.3` 강제 종료 재인증 — OAuth-only 사용자는 "등록된 2FA 또는 이메일 OTP 로 대체" 라고 명시
- **상세**: `disable2fa()` 는 OAuth-only 사용자(`passwordHash=null`)에게 `PASSWORD_REQUIRED` 예외를 throw 해 비활성화를 차단한다. spec §1.4 표는 TOTP 비활성화 조건을 "비밀번호 재확인 + 코드 입력" 으로 정의하는데, `passwordHash=null` 시의 대안 인증 경로(이메일 OTP 등)는 spec 에 선언되어 있지 않아 현재 구현의 차단이 spec 의도와 일치함이 암묵적이다. Rationale 에는 이 시나리오(OAuth-only 사용자가 TOTP 를 활성화·비활성화하는 경우)에 대한 명시적 기록이 없다. 기각된 대안 번복이나 invariant 위반은 아니나, 미래의 패스워드 없는 TOTP 비활성화 요구 시 Rationale 공백이 혼란을 줄 수 있다.
- **제안**: spec §1.4 또는 Rationale 에 "OAuth-only(`passwordHash=null`) 사용자의 TOTP 비활성화는 현재 차단되어 있으며, 대안 인증 경로(이메일 OTP 등)는 별도 결정 사안" 임을 한 줄 명시 (낮은 우선순위).

---

## 핵심 합의 원칙 준수 확인

| 항목 | 준수 여부 |
|------|-----------|
| `user.*` 액션은 세션 `workspaceId` 에 귀속 (Rationale 4.1.B) | 준수 — 세 컨트롤러 모두 `payload.workspaceId` / `user.workspaceId` 사용 |
| 기록 위치는 controller 경계 (서비스 레이어 아님) | 준수 — users·auth·webauthn controller 각각 기록 |
| `POST /auth/reset-password` (무인증) 는 `user.password_changed` 대상 제외 | 준수 — `resetPassword()` 에 `auditLogsService.record()` 호출 없음 |
| `login_history` ↔ `audit_log` 분리 원칙 (워크스페이스 없는 이벤트 = LoginHistory) | 준수 — auth.service.ts 는 `loginHistory.record()` 만 호출 |
| 기각된 대안 "(b) workspaceId nullable" 미채택 (Rationale 4.1.B) | 준수 — 구현에서 `workspaceId` 를 항상 세션에서 읽으며 nullable 확장 없음 |
| 기각된 대안 "(c) 별도 user/personal audit scope 신설" 미채택 (Rationale 4.1.B) | 준수 — 기존 `audit_log` 테이블 그대로 사용 |
| `AUDIT_ACTIONS` union 타입 강제 (인라인 문자열 금지) (§4.1) | 준수 — 세 위치 모두 `AUDIT_ACTIONS.USER_*` 상수 사용 |

---

## 요약

`spec/5-system/` 의 구현(diff-base fcd1d594)은 Rationale 4.1.A·4.1.B 에 기록된 모든 합의 원칙을 준수한다. `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 세 액션은 각각 users·auth·webauthn controller 경계에서 JWT 세션의 `workspaceId` 에 귀속해 기록되며, 기각된 대안(workspaceId nullable·별도 scope 신설)이 재도입된 흔적이 없다. 무인증 `reset-password` 는 spec Rationale 의 "무인증 이벤트 = LoginHistory, workspace 없음 = audit_log 대상 아님" 원칙대로 audit 기록을 생략하고 있다. 명시적으로 기각된 설계가 재도입된 케이스(CRITICAL)나 Rationale 이 없는 결정 번복(WARNING)은 식별되지 않았다. 발견된 INFO 2건은 기존 합의와 충돌하지 않으며, Rationale 문서에 추가 명시를 권장하는 수준이다.

---

## 위험도

NONE
