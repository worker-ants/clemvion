## 발견사항

### 발견사항 없음 — 모든 신규 식별자 충돌 없음

target 변경셋이 도입하는 신규 식별자를 6개 관점별로 점검한 결과 충돌이 발견되지 않았다.

---

#### 점검 내역

**1. 요구사항 ID 충돌**

target 이 새로 도입하는 요구사항 ID 는 없다(spec draft 는 §1.1.B 와 Rationale §1.1.B-1~6 섹션 번호를 사용하며, `spec/5-system/1-auth.md` 의 §1.1.A 다음 자연스러운 연번). 기존에 `§1.1.B` 가 다른 의미로 사용된 흔적 없음.

**2. 엔티티/타입명 충돌**

신규 도입 식별자:
- `pending_email` (DB 컬럼 / `User` entity camelCase: `pendingEmail`)
- `email_change_token` (DB 컬럼 / entity: `emailChangeToken`)
- `email_change_expires_at` (DB 컬럼 / entity: `emailChangeExpiresAt`)
- `pendingEmail: string | null` (`UserProfileDto` 응답 필드)

`user.entity.ts` 에는 현재 위 컬럼이 없으며 (`email_verify_token`/`email_verify_expires_at`/`password_reset_token`/`password_reset_expires_at` 패턴과 동형), codebase 전체 검색에서 `emailChangeToken`, `pending_email`, `pendingEmail`, `email_change_token` 이 존재하지 않음을 확인했다. 기존 `UserProfileDto` (`/codebase/backend/src/modules/users/dto/responses/user-response.dto.ts`) 에는 `pendingEmail` 필드가 없어 신규 추가 충돌 없음.

**3. API endpoint 충돌**

신규 endpoint:
- `POST /api/users/me/email-change/request`
- `POST /api/users/me/email-change/verify`
- `POST /api/users/me/email-change/resend`
- `POST /api/users/me/email-change/cancel`

`users.controller.ts` 에는 현재 `GET me`, `PATCH me`, `POST me/change-password` 만 등록되어 있으며, `sessions.controller.ts` (`@Controller('users/me')`)에는 `GET sessions`, `POST sessions/:familyId/revoke`, `POST sessions/revoke-others`, `GET login-history` 만 있다. `/email-change/*` 경로와 겹치는 기존 핸들러 없음. 프론트엔드 `/profile/change-email` 페이지 디렉토리도 미존재(`change-password` 만 존재) — 라우트 충돌 없음.

**4. 이벤트/메시지명 충돌**

신규 감사 이벤트명: `user.email_changed`

`audit-action.const.ts` 의 `AUDIT_ACTIONS` union 에는 `user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled` 가 있으며 `user.email_changed` 는 없다. `spec/conventions/audit-actions.md` 의 `user` 도메인 행에도 현재 신규 추가된 `email_changed` 이전에는 세 항목만 있었다. 동일 이름이 다른 의미로 사용된 사례 없음. Planned 카탈로그 추가(`user | 과거분사 | email_changed | 미구현`)도 기존 항목과 중복 없음.

**5. 환경변수·설정키 충돌**

target 이 신규 도입하는 ENV var 또는 config key 없음.

**6. 파일 경로 충돌**

변경된 파일:
- `spec/5-system/1-auth.md` — 기존 파일에 섹션 추가, 경로 충돌 없음
- `spec/2-navigation/9-user-profile.md` — 기존 파일에 내용 추가
- `spec/1-data-model.md` — 기존 파일에 User 컬럼 3개 추가
- `spec/conventions/audit-actions.md` — 기존 파일에 행 1개 추가
- `spec/data-flow/1-audit.md` — 기존 파일 갭 목록 업데이트

모두 기존 파일 내 편집이며 신규 spec 파일 생성 없음. 기존 명명 컨벤션(domain/subdomain/*.md) 일치.

**REAUTH_NOT_AVAILABLE 재사용 점검**

`auth.1.B §2.3 재인증 상류 코드 재사용` 이라고 명시되어 있으며, codebase에서 `REAUTH_NOT_AVAILABLE` 은 `sessions.service.ts` 에서 이미 "OAuth-only + 2FA 미설정 사용자는 재인증 불가" 의미로 정의되어 있다 (`/codebase/backend/src/modules/auth/sessions.service.ts` L239). target이 이메일 변경 흐름에서 같은 오류 조건("재인증 수단 없음")에 동일 코드를 재사용하는 것은 의미 일치이며 충돌이 아니다.

---

### 요약

target 변경셋(`spec/5-system/1-auth.md §1.1.B`, `spec/2-navigation/9-user-profile.md`, `spec/1-data-model.md`, `spec/conventions/audit-actions.md`, `spec/data-flow/1-audit.md`)이 도입하는 모든 신규 식별자—DB 컬럼 (`pending_email`, `email_change_token`, `email_change_expires_at`), DTO 필드 (`pendingEmail`), API endpoint 경로 (`/api/users/me/email-change/*`), 프론트엔드 페이지 경로 (`/profile/change-email`), 감사 액션 (`user.email_changed`), 토큰 논리명 (`emailChangeToken`)—모두 기존 사용처와 명칭·의미가 겹치지 않는다. `REAUTH_NOT_AVAILABLE` 은 동일 도메인(재인증 불가 조건)에서 재사용되는 올바른 코드 재활용이며 의미 충돌이 없다.

### 위험도

NONE
