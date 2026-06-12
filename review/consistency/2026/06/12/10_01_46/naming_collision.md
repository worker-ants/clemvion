# 신규 식별자 충돌 검토 결과

**Target 문서**: `spec/5-system/1-auth.md`

---

## 발견사항

### 1. WARNING — WebAuthn 전용 에러 코드가 에러 카탈로그에 미등재

- **target 신규 식별자**: `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `WEBAUTHN_INVALID`, `RECOVERY_CODE_INVALID`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §1.2 및 `/Volumes/project/private/clemvion/spec/conventions/error-codes.md` — 이 파일들이 프로젝트 전체 에러 코드 카탈로그 역할을 한다. WebAuthn 도입으로 신규 6개 코드가 `spec/5-system/1-auth.md` §5 API 표에 정의됐으나, `3-error-handling.md` §1.2 "인증/인가 에러" 카탈로그에 등재되지 않았다.
- **상세**: `3-error-handling.md` §1.2 는 `AUTH_REQUIRED`, `TOKEN_EXPIRED`, `TOKEN_INVALID`, `FORBIDDEN`, `ADMIN_REQUIRED`, `LOGIN_FAILED`, `ACCOUNT_LOCKED` 7종만 열거한다. WebAuthn 기능이 추가되면서 `WEBAUTHN_DISABLED`(503), `WEBAUTHN_VERIFY_FAILED`(400), `INVALID_OPTIONS_TOKEN`(400), `CHALLENGE_INVALID`(401), `WEBAUTHN_INVALID`(401), `RECOVERY_CODE_INVALID`(401) 6종이 `1-auth.md` §5 에만 산재하고 중앙 카탈로그에 없어 에러 코드 가시성이 분산된다.
- **제안**: `3-error-handling.md` §1.2 WebAuthn 서브섹션을 신설하거나 기존 "인증/인가 에러" 행에 6종을 추가한다. 또는 `1-auth.md` §5 에 "에러 코드 SoT 는 `3-error-handling.md §1.2` 참조" 주석을 달아 단방향 참조 구조를 명확히 한다.

---

### 2. WARNING — `CANNOT_REVOKE_CURRENT_SESSION`, `REAUTH_NOT_AVAILABLE` 에러 코드가 auth spec 본문에 미등장, 카탈로그에도 미등재

- **target 신규 식별자**: `CANNOT_REVOKE_CURRENT_SESSION`, `REAUTH_NOT_AVAILABLE`
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/data-flow/2-auth.md` §1.5 — 세션 revoke 흐름 주석에 두 코드가 정의되어 있다. `spec/5-system/1-auth.md` 본문(§2.3 세션 정책 및 §5 API 표)에는 해당 코드가 언급되지 않으며, `3-error-handling.md` 카탈로그에도 없다.
- **상세**: `data-flow/2-auth.md` §1.5 가 실질적 정의처 역할을 하고 있으나, `1-auth.md` §5 API 표의 `POST /api/users/me/sessions/:familyId/revoke` (사용자 프로필 spec 으로 위임)에 에러 응답 내용이 없어 식별자 소재가 불명확하다. auth spec 가 이 세션 관련 에러 코드를 누락하고 있다.
- **제안**: `1-auth.md` §2.3 세션 정책 표 또는 §5 의 세션 엔드포인트 주석에 `CANNOT_REVOKE_CURRENT_SESSION`(400), `REAUTH_NOT_AVAILABLE`(403) 을 명시하거나, 이를 `3-error-handling.md` §1.2 에 등재한다.

---

### 3. INFO — Planned 감사 액션 `password_change`, `2fa_enable/disable` 이 dot-prefix 규약을 따르지 않음

- **target 신규 식별자**: `password_change`, `2fa_enable`, `2fa_disable` (§4.1 Planned 목록)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/1-auth.md` §4.1 Action naming 규약 — "resource dot-prefix 가 필수다 (`<resource>.<verb>`)". 구현된 모든 액션(`integration.created`, `auth_config.create`, `execution.re_run`, `workspace.transfer_ownership`)은 이 규약을 따른다. `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` §1.1 도 동일 규약 확인.
- **상세**: `§4.1 Planned` 행의 `password_change`, `2fa_enable/disable` 은 resource dot-prefix 가 없어 `auth.password_change`, `user.2fa_enable` 등의 형태가 될 것인지 불명확하다. 구현 시점에 이름이 확정되겠지만, Planned 선언이 규약과 일치하지 않으면 구현자가 잘못된 이름을 그대로 쓸 위험이 있다.
- **제안**: Planned 액션 표의 `password_change` → `user.password_change`, `2fa_enable/disable` → `user.2fa_enable` / `user.2fa_disable` 등으로 dot-prefix 형태를 확정해 기재하거나, 표 헤더에 "구현 시 `<resource>.<verb>` 형태로 확정" 주석을 추가한다.

---

### 4. INFO — `forbidden`(lowercase) 과 `FORBIDDEN`(uppercase) 이 같은 403 상황에서 혼재

- **target 신규 식별자**: `forbidden` (§1.5.4 에러 응답 표 — "권한 부족")
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/5-system/3-error-handling.md` §1.2 — `FORBIDDEN` (`UPPER_SNAKE_CASE`, 403). `/Volumes/project/private/clemvion/spec/conventions/error-codes.md` §3 historical-artifact 레지스트리 — `forbidden`(lowercase) 은 초대 API 전용 historical artifact 로 등재, "`초대 API 한정 — 본 `forbidden` 은 초대 흐름 전용 historical artifact 로, 다른 영역의 `UPPER_SNAKE_CASE` 범용 코드와 별개다`" 라고 명시함.
- **상세**: 등재 자체는 돼 있어 CRITICAL 은 아니다. 그러나 `1-auth.md §1.5.4` 표에서 `forbidden` 옆의 맥락 설명이 없어 신규 검토자가 historical artifact 예외임을 모르고 "같은 의미의 코드가 두 가지"로 오인할 수 있다.
- **제안**: `1-auth.md §1.5.4` 표의 `forbidden` / `rate_limited` 행에 "`(historical artifact — error-codes.md §3 등재)`" 각주를 추가해 `error-codes.md §3` 과의 연결을 명확히 한다. 현재 표 아래 `> 명명 — historical-artifact 예외` 블록이 이미 있으나 표 안 `코드` 셀에서 직접 참조가 없어 가시성이 낮다.

---

### 5. INFO — `WEBAUTHN_COUNTER_REGRESSION` 은 `failure_reason` 값인지 error code 인지 경계가 불명확

- **target 신규 식별자**: `WEBAUTHN_COUNTER_REGRESSION` (§1.4.4, §4.3 `login_history`)
- **기존 사용처**: `/Volumes/project/private/clemvion/spec/1-data-model.md` §2.18.2 — `login_history.failure_reason` 컬럼 예시값으로 열거. `/Volumes/project/private/clemvion/spec/data-flow/1-audit.md` §1.2 도 동일.
- **상세**: `1-auth.md §4.3` 및 §1.4.4 에서 `WEBAUTHN_COUNTER_REGRESSION` 이 `login_history.failure_reason` 필드 값 맥락에서 사용되지만, §5 의 `authenticate/verify` 엔드포인트 설명에서는 `401 WEBAUTHN_INVALID` 와 나란히 "counter 역행 시 401 + ... `WEBAUTHN_COUNTER_REGRESSION`" 로 서술돼 HTTP 에러 코드처럼도 읽힌다. `data-flow/2-auth.md §1.2` 는 `failure_reason = WEBAUTHN_INVALID / WEBAUTHN_COUNTER_REGRESSION` 으로 `failure_reason` 서브값임을 명확히 한다.
- **제안**: `1-auth.md §5` API 표의 `authenticate/verify` 행 설명에서 `WEBAUTHN_COUNTER_REGRESSION` 이 HTTP 에러 code 가 아니라 `login_history.failure_reason` 값임을 괄호 주석으로 명시한다. 예: `counter 역행 시 401 WEBAUTHN_INVALID + credential 삭제 + LoginHistory webauthn_failed (failure_reason=WEBAUTHN_COUNTER_REGRESSION)`.

---

## 요약

`spec/5-system/1-auth.md` 가 도입하는 신규 식별자 중 API endpoint, 환경변수, 엔티티명의 직접 충돌은 발견되지 않았다. WebAuthn 엔드포인트(`/api/auth/2fa/webauthn/*`)는 기존 `10-auth-flow.md`, `data-flow/2-auth.md` 와 일관되게 참조된다. 다만 WebAuthn 전용 에러 코드 6종이 중앙 카탈로그(`3-error-handling.md`)에 미등재돼 있고, 세션 revoke 전용 코드 2종도 auth spec 본문에서 누락돼 가시성이 낮다. Planned 감사 액션의 dot-prefix 누락은 구현 시 명명 혼선 가능성이 있다. 이 모두 기존 식별자와의 의미 충돌은 아니며, 카탈로그 완결성·명확성 개선의 필요성이다.

---

## 위험도

LOW
