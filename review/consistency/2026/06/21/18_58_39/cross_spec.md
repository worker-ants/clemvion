# Cross-Spec 일관성 검토 결과

검토 대상: `spec/5-system/` (구현 완료 후 검토, diff-base=origin/main)  
변경 범위: 이메일 변경 흐름 신설 (`spec/5-system/1-auth.md §1.1.B`, `spec/1-data-model.md`, `spec/2-navigation/9-user-profile.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md`)

---

## 발견사항

- **[WARNING]** 재인증 범위 기술 불일치 — `9-user-profile.md §6.1` vs `1-auth.md §1.1.B`
  - target 위치: `spec/2-navigation/9-user-profile.md` §6.1 API 표, `POST /api/users/me/email-change/request` 행
  - 충돌 대상: `spec/5-system/1-auth.md` §1.1.B 핵심 설계 · Rationale 1.1.B-4
  - 상세: `9-user-profile.md §6.1` 은 재인증 조건을 `비밀번호 또는 등록 2FA`로 기술해 TOTP·WebAuthn 양쪽을 포함하는 것으로 읽힌다. 반면 `1-auth.md §1.1.B` 본문과 Rationale 1.1.B-4는 이메일 변경 재인증을 "비밀번호 또는 등록 TOTP" 로 명시하고 WebAuthn step-up은 "현재 미지원"임을 별도로 기재한다. `§1.1.B` 운영 시나리오 표에도 `비밀번호 없음 + TOTP 보유` 행만 있고 WebAuthn-only 계정은 시나리오가 없다. 소비자(프론트엔드·구현자)가 `등록 2FA`를 WebAuthn 포함으로 해석하면 `verifyReauth`가 지원하지 않는 경로를 UI에서 노출할 위험이 있다.
  - 제안: `9-user-profile.md §6.1` 의 `비밀번호 또는 등록 2FA` 문구를 `비밀번호 또는 등록 TOTP (WebAuthn step-up 재인증은 현재 미지원 — 인증 §1.1.B Rationale 1.1.B-4)`로 구체화한다. `1-auth.md §1.1.B` 운영 시나리오 표에 `WebAuthn-only (비밀번호·TOTP 없음)` 행을 추가해 `REAUTH_NOT_AVAILABLE`과 같은 결과임을 명시하는 것도 권장한다.

- **[INFO]** `data-flow/2-auth.md` 에 이메일 변경 흐름 미반영
  - target 위치: 신규 흐름 전반 (`spec/5-system/1-auth.md §1.1.B`, `spec/2-navigation/9-user-profile.md §6.1`)
  - 충돌 대상: `spec/data-flow/2-auth.md §1.7` (비밀번호 재설정·이메일 보조 엔드포인트) · `§2.1 Postgres Schema 매핑`
  - 상세: `data-flow/2-auth.md §1.7`은 `/auth/forgot-password`, `/auth/reset-password`, `/auth/resend-verification`, `/auth/check-email` 만 다루며, 신규 이메일 변경 엔드포인트 4종(`/api/users/me/email-change/request|verify|resend|cancel`)의 시퀀스가 없다. `§2.1 Schema 매핑` 의 `user` 테이블 흐름 목록에도 신규 컬럼 3종(`pending_email`, `email_change_token`, `email_change_expires_at`)이 누락됐다. `spec/1-data-model.md`에는 해당 컬럼이 정상 추가되어 있어 data-flow와 data-model 간 비동기가 생긴다.
  - 제안: `data-flow/2-auth.md §1.7` 에 이메일 변경 흐름 시퀀스(request/verify/resend/cancel)를 추가하고, `§2.1` user 테이블 매핑에 `pending_email·email_change_token·email_change_expires_at` 컬럼을 보완한다. 이메일 변경은 `1-auth.md §1.1.B`가 흐름·토큰 라이프사이클 SoT이므로 data-flow는 시퀀스 다이어그램 수준 보완이면 충분하다.

- **[INFO]** `REAUTH_NOT_AVAILABLE` 에러 코드가 `spec/conventions/error-codes.md` 에 미등재
  - target 위치: `spec/5-system/1-auth.md §1.1.B` (신규 사용 선언) · `spec/2-navigation/9-user-profile.md §6.1`
  - 충돌 대상: `spec/conventions/error-codes.md` (에러 코드 안정성·rename 정책 · historical-artifact 레지스트리)
  - 상세: `REAUTH_NOT_AVAILABLE`은 세션 강제 종료(`data-flow/2-auth.md §1.5`)에서 이미 사용되는 기존 코드이며 이번 이메일 변경에서 재사용된다고 `1-auth.md §1.1.B`에 명시되어 있다. 그러나 `error-codes.md`에는 이 코드의 등재 항목이 없다. `UPPER_SNAKE_CASE` 정규 코드라 historical-artifact 레지스트리 대상은 아니지만, 세션-revoke와 이메일-change 두 맥락에서 동일 코드가 사용된다는 사실과 HTTP 403 매핑이 문서화되어 있지 않다. 파괴적 변경 없이 사용 맥락만 문서화하면 충분하다.
  - 제안: `spec/conventions/error-codes.md` 에 `REAUTH_NOT_AVAILABLE — 403, 재인증 수단 없음(세션 강제 종료·이메일 변경 공통)` 항목을 정규 코드 목록에 추가한다. `VALIDATION_ERROR`·`RESOURCE_CONFLICT` 도 동일한 맥락으로 사용되므로 함께 등재하면 좋다.

---

## 요약

이번 변경(이메일 변경 흐름 신설)의 핵심 spec 영역(`1-auth.md §1.1.B`, `1-data-model.md`, `audit-actions.md`, `data-flow/1-audit.md`)은 서로 일관되게 갱신되었고 직접적인 모순은 없다. 유일한 실질적 위험은 `9-user-profile.md §6.1`의 `비밀번호 또는 등록 2FA` 문구가 `1-auth.md`의 "TOTP only, WebAuthn 미지원" 결정보다 넓게 읽혀 구현·UI 해석 오류를 유발할 수 있다는 점(WARNING)이다. `data-flow/2-auth.md`의 흐름 및 스키마 매핑 미반영은 두 문서 간 동기화 권장 사항이며 기능 동작에는 영향 없다(INFO 2건).

---

## 위험도

LOW
