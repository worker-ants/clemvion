# 신규 식별자 충돌 검토 결과

검토 대상: `plan/in-progress/spec-draft-email-change.md`

---

## 발견사항

### 요구사항 ID 충돌

해당 없음. target 이 요구사항 ID(예: NAV-*, AUTH-* 등의 ID 체계)를 신설하지 않음.

---

### 엔티티/타입명 충돌

- **[INFO]** `UserProfileDto` 에 `pendingEmail` 필드 추가
  - target 신규 식별자: `pendingEmail` (프론트엔드 구현 메모 §5)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/src/modules/users/dto/responses/user-response.dto.ts` — `UserProfileDto` 가 이미 존재하며 `id`, `email`, `name`, `avatarUrl`, `locale`, `theme` 6개 필드만 보유
  - 상세: target 은 `GET /api/users/me` 응답에 `pendingEmail` 을 추가하여 UI pending 표시에 활용하겠다고 선언. 기존 DTO 에 해당 필드가 없으므로 신규 추가이며 이름 충돌은 아님. 단 spec 본문(§3.4 API 표 SoT)에 `GET /api/users/me` 응답 형식 변경이 명시되지 않은 점이 구현 시 오판 위험.
  - 제안: 구현 단계에서 `UserProfileDto.pendingEmail?: string | null` 을 추가할 때 spec §6.1(9-user-profile.md) `GET /api/users/me` 행에 응답 필드 변경을 명시하거나, 별도 DTO 언급을 spec 에 포함할 것.

---

### API endpoint 충돌

- **[INFO]** 신규 4개 엔드포인트는 기존 spec 에 미등록 — 충돌 없음
  - target 신규 식별자: `POST /api/users/me/email-change/request`, `POST /api/users/me/email-change/verify`, `POST /api/users/me/email-change/resend`, `POST /api/users/me/email-change/cancel`
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/2-navigation/9-user-profile.md` §6.1 API 표, `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` §5 — 위 4개 경로 모두 미등록
  - 상세: `/api/users/me/change-password`(기존) 와 `/api/users/me/email-change/*`(신규) 는 이름 구조가 비대칭 (`change-password` vs `email-change`). `change-password` 는 동사가 앞에 오고 `email-change` 는 명사가 앞에 온다. 의미 혼동은 없으나 컨벤션 일관성 측면에서 주의할 수 있음.
  - 제안: 신규 엔드포인트 명명은 `email-change` 방식으로 확정됐으므로 무리하게 `change-email`로 바꿀 필요는 없음. 향후 profile API 추가 시 동사-앞/명사-앞 두 패턴이 혼재하지 않도록 주의.

---

### 이벤트/메시지명 충돌

- **[INFO]** `user.email_changed` 감사 이벤트 — 기존 예고와 정합, 레지스트리에 미등록
  - target 신규 식별자: `user.email_changed`
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` L682: `"향후 user-profile 계열 감사(예: user.email_changed)"` 로 이미 예고됨
    - `/Volumes/project/private/clemvion/spec/conventions/audit-actions.md` §3 레지스트리: `user` resource 행에 `password_changed`, `2fa_enabled`, `2fa_disabled` 만 등록, `email_changed` 는 미등록
  - 상세: 충돌은 없으나 `audit-actions.md` §3 가 SoT 이므로, spec 반영 시 `user` resource 행에 `email_changed (미구현)` 을 추가해야 한다. target 이 이 레지스트리 갱신을 명시하지 않음.
  - 제안: spec 변경 범위에 `/Volumes/project/private/clemvion/spec/conventions/audit-actions.md` §3 레지스트리 `user` 행에 `email_changed | 미구현` 추가를 포함할 것.

---

### 에러 코드 충돌

- **[INFO]** `REAUTH_NOT_AVAILABLE` — 기존 코드 재사용, 의미 확장
  - target 신규 식별자: `REAUTH_NOT_AVAILABLE` (이메일 변경 불가 시)
  - 기존 사용처:
    - `/Volumes/project/private/clemvion/codebase/backend/src/modules/auth/sessions.service.ts` L239: 세션 revoke 시 OAuth-only 무2FA 사용자에게 이미 사용 중
    - `/Volumes/project/private/clemvion/codebase/frontend/src/app/(main)/profile/sessions/sessions-panel.tsx` L116: 프론트엔드가 `REAUTH_NOT_AVAILABLE` 로 분기하는 코드 존재
    - `/Volumes/project/private/clemvion/spec/data-flow/2-auth.md` L203: 세션 revoke 맥락에서 이미 spec 문서화
  - 상세: target 이 "기존 §2.3 코드 재사용" 으로 명시하므로 의도적 재사용이다. 의미("재인증 수단 없음")는 동일하고 HTTP 상태 코드(403)도 같다. 기존 세션 revoke 컨텍스트와 신규 이메일 변경 컨텍스트 양쪽에서 발행되므로 클라이언트가 해당 코드를 수신할 때 HTTP 경로로 구분해야 한다. 프론트엔드 `sessions-panel.tsx` 의 기존 분기는 세션 revoke 전용이라 이메일 변경 페이지의 신규 분기와 런타임 충돌은 없다.
  - 제안: 코드 재사용 자체는 적절하다. 이메일 변경 프론트엔드 구현 시 이 코드를 각 화면 컨텍스트별로 독립 처리함을 명확히 하는 주석을 추가할 것.

- **[INFO]** `EMAIL_ALREADY_IN_USE` — 신규 코드, 충돌 없음
  - target 신규 식별자: `EMAIL_ALREADY_IN_USE` (409)
  - 기존 사용처: spec 및 codebase 에서 이 exact 코드명을 사용하는 곳 없음
  - 상세: 충돌 없음. error-codes.md 규약(§1 의미 기반 명명, UPPER_SNAKE_CASE)에 부합.
  - 제안: 구현 시 `POST /api/auth/register` 의 이메일 중복 처리 코드명과 통일하거나 별도임을 명시.

- **[INFO]** `SAME_EMAIL`, `EMAIL_CHANGE_TOKEN_INVALID`, `NO_PENDING_EMAIL_CHANGE` — 순수 신규, 충돌 없음
  - target 신규 식별자: 위 3개 코드
  - 기존 사용처: spec, conventions, codebase 전체에서 해당 코드명 없음
  - 상세: 충돌 없음. 명명 규약(UPPER_SNAKE_CASE, 의미 기반)에 부합.

---

### 환경변수·설정키 충돌

해당 없음. target 은 신규 ENV var 또는 config key 를 도입하지 않음.

---

### 데이터 모델 필드 충돌

- **[INFO]** `pending_email`, `email_change_token`, `email_change_expires_at` — 신규 컬럼, 기존 패턴과 정합
  - target 신규 식별자: 위 3개 필드 (`spec/1-data-model.md` §2.1 User 에 추가 예정)
  - 기존 사용처: `/Volumes/project/private/clemvion/spec/1-data-model.md` L63-66: `email_verify_token`, `email_verify_expires_at`, `password_reset_token`, `password_reset_expires_at` — 동일 3-필드 패턴의 기존 그룹
  - 상세: 기존 `email_verify_*` / `password_reset_*` 와 이름이 겹치지 않고 `email_change_*` prefix 로 명확히 구분된다. 충돌 없음. 패턴 일관성 높음.

---

### 파일 경로 충돌

- **[INFO]** 마이그레이션 버전 번호 미확정
  - target 신규 식별자: `V0xx` (§1, 실제 번호 미확정 placeholder)
  - 기존 사용처: `/Volumes/project/private/clemvion/codebase/backend/migrations/` 최신 파일은 `V099__node_config_gin_index.sql`
  - 상세: 다음 순번은 `V100` 이 된다. 세 자리 번호(`V0xx`)에서 네 자리(`V100`)로 전환되는 시점이다. Flyway 명명 규칙(`V{version}__{description}.sql`)에는 부합하며 충돌은 없다.
  - 제안: spec 반영 시 `V100` 으로 확정하거나 구현 단계에 위임함을 명기할 것.

---

## 요약

target 문서(`spec-draft-email-change.md`)가 도입하는 신규 식별자 중 기존 사용처와 의미 충돌을 일으키는 항목은 없다. `REAUTH_NOT_AVAILABLE` 은 의도적 재사용이며 의미·HTTP 상태가 동일해 충돌이 아니다. 신규 API 경로 4개, 에러 코드 신규 3개(`SAME_EMAIL`, `EMAIL_CHANGE_TOKEN_INVALID`, `NO_PENDING_EMAIL_CHANGE`)와 재사용 1개(`REAUTH_NOT_AVAILABLE`), 데이터 모델 3컬럼(`pending_email`, `email_change_token`, `email_change_expires_at`) 모두 기존 식별자와 이름이 겹치지 않는다. 주요 후속 조치 사항은 `user.email_changed` 를 `/Volumes/project/private/clemvion/spec/conventions/audit-actions.md` §3 레지스트리에 추가하는 것이며, 이는 target 의 명시 범위에서 누락되어 있다.

---

## 위험도

LOW
