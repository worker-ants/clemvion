# Rationale 연속성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/)
Target 문서: `spec/5-system/1-auth.md` (§1.1.B 이메일 변경 흐름) + `spec/2-navigation/9-user-profile.md` (§2·§6.1 이메일 변경 UI/API)

---

## 발견사항

### 발견사항 없음 — 모든 주요 결정이 Rationale 와 정합

아래에 각 검토 관점별 검증 결과를 기록한다.

---

### 관점 1: 기각된 대안의 재도입

**[NONE]** 기각 대안 재도입 없음

- `spec/5-system/1-auth.md` Rationale 1.1.B-1 에서 명시적으로 기각한 "(a) 옛+신규 둘 다 링크 확인" 과 "(b) 재인증 없이 신규만 확인" 두 대안은 target 어디에도 재도입되지 않았다.
- Rationale 1.1.B-4 에서 기각한 "이메일 변경 재인증에 이메일 OTP 사용"은 §1.1.B 핵심 설계 목록("이메일 OTP 배제")과 §6.1 request endpoint("비밀번호 또는 등록 2FA")에서 일관되게 배제된다.
- Rationale 2.3.C 에서 기각한 대안 (a) "전 세션 revoke + 재발급 없음" 및 (b') "현재 family 제외 revoke"는 채택되지 않았다. §1.1.B verify 및 §2.3 이메일 변경 시 처리는 "전 family revoke + 현재 디바이스 재발급" 으로 정확히 선택된 옵션 B를 따른다.
- `spec/2-navigation/9-user-profile.md` Rationale 에서 기각한 "모달 일원화", "전 항목 sub-route", "단일 페이지 + 섹션별 Save 버튼" 패턴은 이번 이메일 변경 UI(§2.0, sub-route 전용 페이지)에서 채택되지 않았다.

---

### 관점 2: 합의된 원칙 위반

**[NONE]** 원칙 위반 없음

1. **SHA-256 해시 at-rest 원칙**: §1.1 표 "토큰 at-rest 저장" + Rationale 1.1.B 에 확립된 "raw 토큰 DB 미저장, SHA-256 해시만" 원칙이 `emailChangeToken`(`email_change_token` 컬럼)에도 일관 적용되고 있다. `spec/1-data-model.md` 의 `email_change_token: String?` 컬럼 설명("이메일 변경 확인 토큰 SHA-256 해시")이 이를 명시한다.

2. **verify 엔드포인트 인증 필수 원칙**: Rationale 1.1.B-2 에서 "signup verify-email 의 @Public 대신 인증 필수(JWT)" 를 결정한 근거("누출 링크 단독으로는 변경 불가")가 `spec/2-navigation/9-user-profile.md` §6.1 `POST /api/users/me/email-change/verify` 항목에서 "(JWT 인증)" 으로 그대로 지켜진다.

3. **REAUTH_NOT_AVAILABLE 코드 재사용 원칙**: §1.1.B 핵심 설계 "재인증 수단 없는 계정 차단" 에서 `REAUTH_NOT_AVAILABLE` 을 §2.3 재인증 상류 코드 재사용으로 정의했고, §6.1 request endpoint 에서 "403 `REAUTH_NOT_AVAILABLE`" 로 일치한다.

4. **세션 처리 동형 원칙(Rationale 2.3.C)**: 비밀번호 변경과 이메일 변경의 세션 처리를 동형(전 family revoke + 현재 디바이스 재발급)으로 두는 원칙이 §2.3 "이메일 변경 시 처리" 항과 §6.1 verify endpoint 설명에서 모두 충족된다. verify 경로(`/api/users/me/*`)에 refresh 쿠키가 미첨부된다는 구조적 이유도 Rationale 2.3.C 설명과 §2.3 표 "이메일 변경 시 처리" 의 근거 설명이 일치한다.

5. **audit details 에 raw 이메일 미저장 원칙(Rationale 1.1.B-6)**: `user.email_changed` 감사 항목(§4.1 Planned)에 "details 에 raw 이메일 미저장(PII 노출 최소화 — Rationale 1.1.B-6)" 이 명시되어 있어 원칙이 관련 조항에 전달된다.

6. **UI 편집 분리 원칙**: `spec/2-navigation/9-user-profile.md` Rationale 의 "고위험 항목은 별도 sub-route 진입 자체가 의도 표명" 원칙이 이메일 변경에 `/profile/change-email` sub-route 로 일관 적용된다.

---

### 관점 3: 결정의 무근거 번복

**[NONE]** 무근거 번복 없음

이번 target 문서들이 도입한 주요 결정은 모두 `## Rationale` 섹션을 동반한다:

- §1.1.B 의 이메일 변경 전체 흐름 설계 → Rationale 1.1.B-1 ~ 1.1.B-6 (6개 항) 완비.
- 이메일 변경 verify 엔드포인트의 세션 처리 → §2.3 표 "이메일 변경 시 처리" 에 근거 내재("비밀번호 변경과 동형, Rationale 2.3.C 공유").
- `user.email_changed` 감사 이벤트의 workspace 귀속 → §4.1 Planned 항목에 "(verify 는 인증 세션)" 근거 명시 + 4.1.B 기각 대안과 동일 workspace-귀속 원칙 공유.

과거 확립된 결정을 뒤집는 항목이 없으므로 새 Rationale 의 부재가 문제가 되는 상황 자체가 없다.

---

### 관점 4: 암묵적 가정 충돌

**[NONE]** invariant 위반 없음

1. **`audit_log.workspaceId` non-nullable invariant**: Rationale 4.1.B 에서 "인증된 세션에서만 발생하므로 항상 workspaceId 있음" 을 invariant 로 확립했다. `user.email_changed` 는 `POST /api/users/me/email-change/verify` (JWT 인증 필수) 에서만 발생하므로 동일 invariant 를 충족한다. §4.1 Planned 항목도 "(verify 는 인증 세션)" 으로 이 전제를 명시한다.

2. **SHA-256 해시 at-rest invariant**: `emailVerifyToken`/`passwordResetToken` 이 SHA-256 해시로만 저장되는 invariant(`spec/5-system/1-auth.md` §1.1 표)가 `emailChangeToken` 에도 동일하게 적용된다. `spec/1-data-model.md` 컬럼 정의("SHA-256 해시")가 이를 보강한다.

3. **`login_history` event enum 재사용**: `session_revoked` enum 값이 이메일 변경 confirm 에도 재사용되는 것은 §4.3 표와 §2.3 표 "이메일 변경 시 처리" 에 모두 "enum 값 재사용이라 DB CHECK·마이그레이션 불요" 로 명시되어 있어 DB schema invariant 와 충돌하지 않는다.

4. **`PATCH /users/me` 이메일 제외 invariant**: §6.1 `PATCH /api/users/me` 항목에 "(이메일 제외 — 이메일은 `/email-change/*` 별도 흐름)" 을 명시해, 이메일이 일반 프로필 PATCH 경로를 통해 변경될 수 있는 우회로를 차단하고 §1.1.B 의 재인증 요구 invariant 를 보호한다.

5. **이메일 OTP 배제 boundary**: §2.3 "강제 종료 재인증" 은 이메일 OTP 를 허용하지만, 이메일 *변경* 재인증에는 Rationale 1.1.B-4 의 "순환성" 논거로 배제한다. 두 컨텍스트의 boundary 가 §1.1.B 핵심 설계 목록("§2.3 의 '이메일 OTP' 대체 수단은 채택하지 않는다")과 Rationale 1.1.B-4("§2.3 의 세션-revoke 재인증 정의 자체는 본 작업에서 변경하지 않는다")에서 일관되게 지켜진다.

---

## 요약

이번 spec 개정(`spec/5-system/1-auth.md` §1.1.B + `spec/2-navigation/9-user-profile.md` §2/§6.1)은 기존 Rationale 들과 전면적으로 정합한다. 기각 대안(옛 이메일 이중 인증, 이메일 OTP 재인증, 전 세션 revoke + 재발급 없음 등)은 재도입되지 않았고, SHA-256 at-rest·verify 인증 필수·audit workspaceId non-nullable·session_revoked enum 재사용 등 확립된 invariant 가 모두 지켜졌다. 새로 도입된 결정(이메일 변경 흐름 전체, verify 세션 처리, PII 감사 최소화 등)은 각각 Rationale 1.1.B-1~6 이 완비되어 무근거 번복의 여지가 없다. Rationale 연속성 관점에서 별도 조치가 필요한 항목이 발견되지 않았다.

---

## 위험도

NONE
