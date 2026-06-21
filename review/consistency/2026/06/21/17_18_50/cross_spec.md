# Cross-Spec 일관성 검토 결과

대상 문서: `plan/in-progress/spec-draft-email-change.md`
검토 날짜: 2026-06-21

---

## 발견사항

### [INFO] SoT 경계 — 엔드포인트 표 이중 선언 패턴이 기존 규약과 일치하는지 명시 필요
- **target 위치**: §2.5 + §3.4 (auth §5 와 user-profile §6.1 양쪽에 동일 행 삽입 예정)
- **충돌 대상**: `spec/5-system/1-auth.md §5` (line 455: "사용자 본인 세션·이력 관리 엔드포인트는 사용자 프로필 spec §6.1 에 정의"), `spec/2-navigation/9-user-profile.md §6.1`
- **상세**: 기존 auth §5 는 `/api/users/me/*` 계열 엔드포인트를 user-profile spec §6.1 이 소유(SoT)하고 auth §5 는 포인터만 둔다는 패턴을 이미 사용한다. target §2.5 의 주석("SoT 경계: 위 엔드포인트는 /api/users/me/* 라 사용자 프로필 spec §6.1 이 표 소유, auth §5 는 포인터로 참조")이 이 패턴을 따르고 있어 의도는 올바르나, auth §5 에 삽입하는 행 자체가 실제로 포인터 형식(링크만)인지 아니면 완전 정의 행인지 draft 에서 명확하지 않다. user-profile §6.1 이 SoT 라면 auth §5 삽입 행은 "[See user-profile §6.1]" 단일 포인터 행이어야 한다.
- **제안**: §2.5 의 표 행을 full 정의 행이 아닌 포인터 행("email-change 엔드포인트 — 상세 [User Profile §6.1]")으로 조정하거나, 현행 `POST /api/users/me/change-password` 가 auth §5 에 어떻게 처리되어 있는지 확인 후 동일 패턴 적용.

---

### [INFO] 감사 액션 `user.email_changed` — audit-actions.md 레지스트리 미등록
- **target 위치**: §2.4 (user.email_changed 추가 선언)
- **충돌 대상**: `spec/conventions/audit-actions.md §3` 도메인별 분류 레지스트리, `spec/data-flow/1-audit.md §1.1` 커버리지 SoT
- **상세**: target 은 `user.email_changed` 를 `Planned` 로 auth §4.1 에 추가한다고 명시한다. 기존 `user` resource 는 `audit-actions.md §3` 에서 과거분사(§2.1) 패턴으로 등록되어 있으며(`password_changed`, `2fa_enabled`, `2fa_disabled`). `email_changed` 도 동일 과거분사 패턴을 따르므로 명명 규약과는 충돌이 없다. 다만 `audit-actions.md §3` 레지스트리와 `data-flow/1-audit.md §1.1` 표에 `user.email_changed` 가 아직 없으며, auth §4.1.A Rationale 의 예고("향후 user-profile 계열 감사(예: user.email_changed)")와는 정합한다.
- **제안**: auth §4.1 Planned 행 추가와 함께 `audit-actions.md §3` 레지스트리에도 `user.email_changed | 과거분사(§2.1) | 미구현` 행을 추가하여 3개 문서를 동기화. data-flow/1-audit.md §1.1 커버리지 갭 섹션도 동기화 필요(현재는 갭 SoT가 data-flow 이므로).

---

### [INFO] LoginHistory `session_revoked` enum — 이메일 변경 bulk revoke 재사용 선언이 auth §4.3 와 미동기화
- **target 위치**: §2.3 (확인 완료 시 전 family revoke + 현재 디바이스 재발급, login_history 에 session_revoked bulk(familyId=null) 1건)
- **충돌 대상**: `spec/5-system/1-auth.md §4.3` LoginHistory 이벤트 표 (session_revoked 행 설명: "비밀번호 변경 성공 시 전체 family revoke")
- **상세**: 기존 §4.3 의 `session_revoked` 설명은 "사용자가 활성 세션 목록에서 다른 family 강제 종료, 또는 비밀번호 변경 성공 시 전체 family revoke" 로 정의된다. target 은 이 enum 을 이메일 변경 커밋 시에도 같은 방식으로 재사용한다고 명시한다. enum 값 재사용 자체는 설계적으로 타당하며(마이그레이션 불요) 기존 `session_revoked` 의 의미(세션 revoke 발생)와 모순되지 않는다. 다만 §4.3 표의 `session_revoked` 행 설명이 현재 비밀번호 변경만 명시하므로 이메일 변경 시나리오를 추가해야 한다.
- **제안**: auth §4.3 의 `session_revoked` 행에 "또는 이메일 변경 확인(`POST /api/users/me/email-change/verify`) 성공 시 전체 family revoke" 를 병기. data-flow/2-auth.md 에도 이메일 변경 revoke 흐름 시퀀스 동기화 검토.

---

### [INFO] `GET /api/users/me` 응답에 `pendingEmail` 필드 추가 — UserDto 계약이 user-profile §6.1 에 미명시
- **target 위치**: §5 프론트엔드 메모 ("GET /api/users/me 응답에 pendingEmail 노출 — UserProfileDto 에 추가")
- **충돌 대상**: `spec/2-navigation/9-user-profile.md §6.1` (GET /api/users/me 정의), `spec/1-data-model.md §2.1 User`
- **상세**: target 이 `GET /api/users/me` 응답 DTO 에 `pendingEmail: string | null` 필드를 추가하는 것은 기존 spec 에 명시되지 않은 변경이다. 이 필드는 `pending_email` DB 컬럼(신규)에서 오므로 data-model §2.1 에 컬럼이 추가되면 자연스럽게 따라오나, user-profile spec §6.1 의 GET 응답 shape 에 대한 명시가 없다. spec 이 아니라 "프론트엔드 구현 메모" 로만 둔 것은 이를 spec 본문이 아닌 구현 힌트로 의도한 것으로 보이나, `UserProfileDto` 는 API 계약이므로 user-profile §6.1 에 명시해야 한다.
- **제안**: user-profile §6.1 GET /api/users/me 행에 응답 shape 에 `pendingEmail: string | null` 추가 명시. 또는 §2.1 프로필 필드 표의 이메일 행에 "pending 상태 표시용으로 GET /api/users/me 가 pendingEmail 반환" 주석 추가.

---

### [WARNING] 재인증 계약 — 기존 §2.3 "강제 종료 재인증" 의 이메일 OTP 대체 수단이 target 에서 누락
- **target 위치**: §2.1 흐름 1.a ("password_hash 보유 → 비밀번호 검증 / 없으면 등록된 2FA factor")
- **충돌 대상**: `spec/5-system/1-auth.md §2.3 세션 정책` ("강제 종료 재인증: 비밀번호 재확인 필수. OAuth-only 사용자는 등록된 2FA(TOTP 또는 WebAuthn) 또는 이메일 OTP 로 대체. 두 방식 모두 등록한 사용자는 §1.4.2 의 우선순위(WebAuthn 우선)를 따른다")
- **상세**: 기존 §2.3 의 "강제 종료 재인증" 은 이메일 OTP 를 OAuth-only 계정의 대체 수단으로 포함한다. target 의 재인증 계약은 "password_hash 없으면 등록된 2FA factor" 만 언급하고 이메일 OTP 를 명시하지 않는다. target §확정된 설계 §1 에서 "§2.3 강제 종료와 동일한 재인증 계약"이라 표방하나 이메일 OTP 가 빠져있다면 계약이 실제로 동일하지 않다. 이메일 변경 맥락에서 이메일 OTP 를 의도적으로 배제했다면(이메일 변경이 곧 이메일 접근권을 증명해야 하는 상황이므로 이메일 OTP 로 재인증을 대체하는 것이 부적절할 수 있음) Rationale 이 필요하다. 그렇지 않으면 §2.3 계약과의 비일관성이 남는다.
- **제안**: target §2.1.a 에 이메일 OTP 허용 여부를 명시적으로 결정하고 기술. §2.3 강제 종료 재인증 계약과 완전히 동일하다면 이메일 OTP 포함을 명시; 이메일 변경 특성상 이메일 OTP 를 배제한다면 §2.3 계약과의 차이를 Rationale 에 설명(이메일 변경 flow 에서 이메일 OTP 허용은 "옛 메일함 접근권"이 재인증 증거가 되는데 이것이 target 설계 원칙 R1 과 모순될 수 있음을 명시).

---

### [WARNING] `REAUTH_NOT_AVAILABLE` 에러 코드 — 기존 §2.3 코드로 표기되나 spec 에 정의된 코드가 확인 안 됨
- **target 위치**: §4 에러 코드 표 ("REAUTH_NOT_AVAILABLE | 403 | 재인증 수단 없음(OAuth-only 무2FA) — 기존 §2.3 코드 재사용")
- **충돌 대상**: `spec/5-system/1-auth.md §2.3`, `spec/conventions/error-codes.md §3` historical-artifact 레지스트리
- **상세**: target 은 `REAUTH_NOT_AVAILABLE` 을 "기존 §2.3 코드 재사용"으로 표기하나, auth §2.3 세션 정책 표 본문에는 이 코드가 명시적으로 정의된 행이 없다(강제 종료 재인증 실패 응답 코드가 §2.3 텍스트에 기술되지 않음). `spec/conventions/error-codes.md §3` historical-artifact 레지스트리에도 등록되지 않았다. 기존에 구현된 코드라면 auth.service.ts 등 코드에 실제로 존재할 것이나 spec 레벨에서는 미확인 상태다. 신규 코드라면 "재사용"이 아닌 "신설"이며 이는 단순 명명 문제가 아니라 기존 계약과의 정합 판단에 영향을 준다.
- **제안**: 코드 또는 auth spec §2.3 에 `REAUTH_NOT_AVAILABLE` 정의가 실제 존재하는지 확인. 없으면 target §4 의 "기존 §2.3 코드 재사용" 표기를 "신규 코드 신설"로 수정하고, error-codes.md 의 의미 기반 명명 규약(§1)에 따른 코드임을 확인.

---

## 요약

target 문서(spec-draft-email-change)는 기존 `spec/5-system/1-auth.md`, `spec/2-navigation/9-user-profile.md`, `spec/1-data-model.md` 세 파일과 CRITICAL 수준의 직접 모순은 발견되지 않는다. 데이터 모델 확장(3 컬럼 nullable add)은 기존 User 엔티티의 email_verify_token 3-필드 패턴을 복제하는 방식으로 모델 충돌이 없고, API 엔드포인트도 `/api/users/me/*` namespace 를 사용해 기존 라우팅 구조와 일치하며, 감사 액션 `user.email_changed` 는 과거분사(§2.1) 패턴을 따라 audit-actions 규약과 정합한다. 주요 관심사는 두 가지 WARNING(재인증 계약의 이메일 OTP 누락 여부 결정, REAUTH_NOT_AVAILABLE 코드의 기존/신규 여부 확인)과 네 가지 INFO(엔드포인트 SoT 패턴 명시, audit-actions.md 레지스트리 동기화, session_revoked 행 설명 동기화, pendingEmail DTO 계약 명시화)이다. Warning 사항들은 spec 반영 전에 명확히 결정하고 기술해야 하나, spec 채택 자체를 차단할 수준의 모순은 아니다.

## 위험도

LOW
