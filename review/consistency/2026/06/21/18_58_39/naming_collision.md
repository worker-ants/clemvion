## 발견사항

- **[INFO]** `emailChangeToken` — 기존 token 명명과 일관성 있는 신규 도입
  - target 신규 식별자: `emailChangeToken` (`spec/5-system/1-auth.md` §1.1 표, §1.1.B)
  - 기존 사용처: `spec/1-data-model.md` L63 `email_verify_token`, L65 `password_reset_token`; `codebase/backend/src/modules/users/entities/user.entity.ts` L70 `emailVerifyToken`, L80 `passwordResetToken`
  - 상세: 기존 `emailVerifyToken`·`passwordResetToken` 과 동일 패턴으로 SHA-256 해시 저장 정책을 적용하는 신규 토큰명. 이름 형태·저장 정책 모두 일관되며, DB 컬럼명(`email_change_token`, `email_change_expires_at`) 은 아직 데이터 모델 spec(`spec/1-data-model.md` User 테이블 표)에 추가되지 않았다. 충돌은 없으나 data model 표 갱신이 누락됨.
  - 제안: `spec/1-data-model.md` §2.1 User 테이블에 `email_change_token`, `email_change_expires_at`, `pending_email` 컬럼 행을 추가하여 단일 진실을 유지해야 한다.

- **[INFO]** `pending_email` / `pendingEmail` — 기존 User 엔티티에 없는 신규 필드
  - target 신규 식별자: `pending_email` (DB 컬럼), `pendingEmail` (API 응답 `UserProfileDto`, `spec/2-navigation/9-user-profile.md` §6.1)
  - 기존 사용처: `codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` (현재 `pendingEmail` 없음); `codebase/frontend/src/lib/api/users.ts` `UserProfile` 인터페이스 (현재 `pendingEmail` 없음)
  - 상세: 충돌 없음. 기존 `UserProfileDto`·`UserProfile` 에 동일 이름이 없어 충돌 위험 없다. 단, 데이터 모델 spec 표에서 컬럼 미정의 상태이므로 data model 단일 진실 원칙이 불완전.
  - 제안: `spec/1-data-model.md` §2.1 User 테이블에 `pending_email String?` 행 추가.

- **[INFO]** `user.email_changed` 감사 액션 — 기존 `AUDIT_ACTIONS` 에 없는 신규 도입
  - target 신규 식별자: `user.email_changed` (`spec/5-system/1-auth.md` §4.1 구현 액션 표 및 §1.1.B)
  - 기존 사용처: `codebase/backend/src/modules/audit-logs/audit-action.const.ts` `AUDIT_ACTIONS` (현재 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 만 있음). 기존 spec `1-auth.md` (main 브랜치) L682 에 "향후 `user.email_changed`" 예고 언급.
  - 상세: 기존 `AUDIT_ACTIONS` 에 `USER_EMAIL_CHANGED` 키가 없고 `'user.email_changed'` 문자열도 없다. target spec 이 이를 "구현된 액션" 표에 추가했으나 코드상 `AUDIT_ACTIONS` const 에는 미추가 상태다. 의미·네임스페이스 충돌은 없다 — main 브랜치 spec 이 예고했던 값과 완전히 일치. 코드 추가가 pending 상태일 뿐.
  - 제안: 구현 시 `AUDIT_ACTIONS.USER_EMAIL_CHANGED = 'user.email_changed'` 를 `audit-action.const.ts` 에 추가한다.

- **[INFO]** 신규 API 엔드포인트 4개 — 기존 사용처 없음, 충돌 없음
  - target 신규 식별자: `POST /api/users/me/email-change/request`, `POST /api/users/me/email-change/verify`, `POST /api/users/me/email-change/resend`, `POST /api/users/me/email-change/cancel`
  - 기존 사용처: `codebase/backend/src/modules/users/users.controller.ts` 에는 `GET me`, `PATCH me`, `POST me/change-password` 만 존재. `spec/2-navigation/9-user-profile.md` 및 `spec/5-system/1-auth.md` (main 브랜치) 어디에도 해당 경로가 없었음.
  - 상세: 기존에 동일 method+path 조합이 없다. 충돌 없음. 단, `email-change/resend`(throttle 5/min)와 기존 `POST /api/auth/resend-verification`(throttle 5/min)은 모두 재발송 패턴이지만 대상(이메일 변경 pending vs 회원가입 인증)이 명확히 달라 혼동 여지는 없다.
  - 제안: 없음.

- **[INFO]** 프론트엔드 라우트 `/profile/change-email` — 기존 라우트 없음
  - target 신규 식별자: `/profile/change-email` (`spec/2-navigation/9-user-profile.md` §2)
  - 기존 사용처: `codebase/frontend/src/app/(main)/profile/` 에는 `change-password/`, `security/`, `sessions/`, `alerts/` 폴더만 존재. `change-email/` 폴더 없음.
  - 상세: 기존 라우트와 충돌 없음.
  - 제안: 없음.

- **[INFO]** `REAUTH_NOT_AVAILABLE` 에러 코드 재사용
  - target 신규 식별자: 이메일 변경 `request` 에서 OAuth-only 계정에 403 `REAUTH_NOT_AVAILABLE` 반환 (`spec/5-system/1-auth.md` §1.1.B)
  - 기존 사용처: `codebase/backend/src/modules/auth/sessions.service.ts` L239 — 세션 강제 종료 재인증 경로에서 동일 코드 이미 사용 중. `spec/data-flow/2-auth.md` L203 에서 "세션 revoke 재인증" 맥락으로 정의됨.
  - 상세: target spec 이 의도적으로 "§2.3 재인증 상류 코드 재사용"으로 명시하고 있으며, 동일 의미(재인증 수단 없음)로 같은 코드를 재사용하는 것이다. 의미 충돌이 아닌 **의도적 재사용**. 혼동 여지 없음.
  - 제안: 없음.

## 요약

target 변경(`spec/5-system/1-auth.md` §1.1.B 이메일 변경 흐름 추가, `spec/2-navigation/9-user-profile.md` 관련 UI/API 추가)이 도입하는 신규 식별자(`emailChangeToken`, `pending_email`/`pendingEmail`, `user.email_changed`, `/api/users/me/email-change/*` 4 엔드포인트, `/profile/change-email` 라우트)는 기존 코드베이스 및 spec 어디와도 의미 충돌이 없다. 유일한 주의 사항은 **`spec/1-data-model.md` User 테이블에 `email_change_token`, `email_change_expires_at`, `pending_email` 컬럼 행이 추가되지 않아 단일 진실 원칙이 불완전**하다는 점이나, 이는 해당 데이터 모델 spec 의 보완 문제이지 식별자 충돌은 아니다. `REAUTH_NOT_AVAILABLE`은 의도적 재사용이고, `user.email_changed`는 기존 spec이 예고했던 식별자와 일치한다.

## 위험도

LOW
