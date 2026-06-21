# Plan 정합성 검토 — spec-draft-email-change

**검토 대상**: `plan/in-progress/spec-draft-email-change.md`
**검토 기준**: `plan/in-progress/**` 진행 중 plan 과의 정합성 (미해결 결정 충돌 / 선행 plan 미해소 / 후속 항목 누락)

---

## 발견사항

### [WARNING] §2.3 재인증 계약 소환 — "이메일 OTP" 브랜치와 불일치

- **target 위치**: `plan/in-progress/spec-draft-email-change.md` §확정된 설계 item 1, §2 §1.1.B 흐름 step 1-a, §에러 코드 §4 `REAUTH_NOT_AVAILABLE` 행
- **관련 plan**: 없음 (해결되지 않은 spec 드리프트 — `spec/5-system/1-auth.md §2.3` 표에 잔존)
- **상세**:
  Target plan 은 이메일 변경의 재인증으로 "§2.3 강제 종료와 동일한 **재인증 계약**" 을 재사용한다고 명시하고, OAuth-only 무2FA 계정을 `REAUTH_NOT_AVAILABLE` 로 차단한다. 그런데 `spec/5-system/1-auth.md §2.3` 표의 "강제 종료 재인증" 행은 "OAuth-only 사용자는 등록된 2FA (TOTP 또는 WebAuthn) **또는 이메일 OTP** 로 대체" 라고 적혀 있다. 이메일 OTP 는 현재 codebase 에 구현이 없고(`codebase/backend/src/modules/auth/sessions.service.ts verifyReauth` 가 password + TOTP 만 처리), `spec/data-flow/2-auth.md §1.5` 도 이메일 OTP 언급 없이 `REAUTH_NOT_AVAILABLE` 만 명시한다.
  Target plan 의 "OAuth-only 무2FA → REAUTH_NOT_AVAILABLE 차단" 설계는 실제 구현·data-flow spec 과 일치하지만, spec/1-auth.md §2.3 본문의 "이메일 OTP" 문구와 표면적으로 충돌한다. 이 §2.3 텍스트 드리프트가 어떤 plan 에서도 아직 해결 대상으로 지정되지 않았으며, target plan 이 그 spec 텍스트를 "계약" 으로 인용하면서 동시에 이메일 OTP 를 제외한 설계를 확정하고 있어 해석 모호성이 생긴다.
- **제안**: target plan(`spec-draft-email-change.md`) 의 "§2.3 계약 재사용" 설명에 "(이메일 OTP 브랜치는 미구현이므로 비밀번호/TOTP/WebAuthn 에 한정)" 를 명시 보완하거나, spec/1-auth.md §2.3 의 "이메일 OTP" 문구를 project-planner 가 이번 spec 반영 시 함께 정정(이 드리프트는 기존 구현과 맞지 않는 레거시 문구)한다.

---

### [INFO] `spec-sync-user-profile-gaps.md` — 이메일 관련 항목과의 관계 미기재

- **target 위치**: `plan/in-progress/spec-draft-email-change.md` §다음 단계
- **관련 plan**: `plan/in-progress/spec-sync-user-profile-gaps.md`
- **상세**:
  `spec-sync-user-profile-gaps.md` 는 `spec/2-navigation/9-user-profile.md` 의 미구현 항목을 추적한다. 현재 user-profile spec §2.0 표의 이메일 행은 "별도 프로세스 / 현 단계 미구현" 으로 표기돼 있다. Target plan 이 spec 에 반영되면 이 미구현 표기가 구현 경로로 전환되어 user-profile-gaps plan 의 추적 범위가 좁아진다. 이 연계가 target plan 의 "다음 단계" 항목 또는 user-profile-gaps plan 에 언급되지 않았다.
- **제안**: target plan 의 §다음 단계에 "spec 반영 시 `spec-sync-user-profile-gaps.md` 의 이메일 관련 표기 연동 확인" 한 줄을 추가하거나, 또는 user-profile-gaps.md 의 비고에 본 plan 링크를 기재해 추적 중복·누락을 방지한다. 실질 차단 사항은 아님.

---

### [INFO] `refactor-auth-reverify-unify.md` — 후속 spec-doc 갱신과의 간섭 가능성

- **target 위치**: `plan/in-progress/spec-draft-email-change.md` §2 §2.3 세션 정책 신규 행 추가
- **관련 plan**: `plan/in-progress/refactor-auth-reverify-unify.md` §범위 밖 / 후속 (spec 문서)
- **상세**:
  `refactor-auth-reverify-unify.md` 의 "범위 밖 / 후속" 에는 `1-auth.md §2.3` 에 self-revoke 방지(`400 CANNOT_REVOKE_CURRENT_SESSION`) 정책 명시 + `data-flow/2-auth.md §1.5` 보강 이 미착수 INFO 항목으로 남아 있다. Target plan 도 `1-auth.md §2.3` 에 "이메일 변경 시 처리" 행을 추가할 계획이다. 같은 §2.3 표를 두 경로가 독립적으로 편집할 예정이므로, 순서에 따라 편집 충돌 또는 누락이 발생할 수 있다.
- **제안**: 두 작업이 동일 테이블을 수정하므로 target plan spec 반영 시 refactor-auth-reverify-unify 의 미착수 INFO 항목도 함께 처리하거나, 해당 plan 에 "이메일 변경 spec 반영 PR 이 §2.3 표 편집 선행 — 재확인 필요" 메모를 추가한다. 실질 차단 사항은 아님.

---

### [INFO] `audit-actions.md` convention 갱신 누락 가능성

- **target 위치**: `plan/in-progress/spec-draft-email-change.md` §2.4 §4.1 감사 — `user.email_changed` 추가
- **관련 plan**: 해당 없음 (convention 파일 직접 갱신 여부만 확인)
- **상세**:
  Target plan 은 `spec/5-system/1-auth.md §4.1` 에 `user.email_changed` 를 Planned 로 등재한다고 명시하지만, `spec/conventions/audit-actions.md` (naming·시제 규약 SoT) 에 동일 항목 등재가 필요한지 여부를 언급하지 않는다. 현행 `1-auth.md §4.1.A Rationale` 은 이미 `user.email_changed` 를 예고 예시로 언급해 두었으므로, 추가 자체는 spec 내 정합이나, audit-actions.md 카탈로그 반영 여부를 target plan 의 다음 단계(§3 side-effect 점검)에서 명시하면 추적이 명확해진다.
- **제안**: target plan 의 §다음 단계 §3 "side-effect 점검" 에 "`spec/conventions/audit-actions.md` 에 `user.email_changed` 등재 필요 여부 확인" 을 추가 — 현재 audit-actions.md 구조상 `1-auth.md §4.1` 이 SoT 이므로 등재 불요일 수 있으나 명시적 확인이 필요하다.

---

## 요약

Target plan(`spec-draft-email-change.md`)은 사용자가 확정한 설계를 담고 있으며, 활성 in-progress plan 들과 직접 충돌하는 미해결 결정 우회나 선행 plan 미해소 CRITICAL 항목은 없다. 주된 주의 사항은 `spec/5-system/1-auth.md §2.3` 표에 남아 있는 "이메일 OTP" 문구와 target plan 이 재사용 선언하는 "§2.3 재인증 계약" 간의 표면적 불일치다(실제 구현은 target plan 과 일치하나 spec 텍스트가 드리프트 상태). 이 드리프트를 target plan 의 spec 반영 시 명시적으로 정정하거나 주석으로 한정하면 후속 구현자가 혼동 없이 계약을 해석할 수 있다. 나머지 두 항목은 spec §2.3 동시 편집 순서 조율과 user-profile-gaps plan 연계 표기 정도로 실질 차단 수준이 아니다.

## 위험도

LOW
