# 신규 식별자 충돌 검토 결과

**검토 대상**: `spec/5-system/1-auth.md`
**검토 모드**: spec draft (--spec)
**검토 일시**: 2026-06-12

---

## 발견사항

### 요구사항 ID 충돌

요구사항 ID(예: `AUTH-*`, `SEC-*` 형식의 named ID) 는 target 문서에 부여되어 있지 않다. `spec/5-system/_product-overview.md` 에도 해당 영역의 요구사항 ID 네임스페이스가 정의된 흔적이 없다. 충돌 없음.

---

### 엔티티/타입명 충돌

특이사항 없음. target 이 참조하는 `WebAuthnCredential`(`§1.4.4`), `LoginHistory`(`§4.3`), `RefreshToken`(`§2`), `WebAuthnModule`(`Rationale 1.4.H`) 은 모두 `spec/1-data-model.md §2.21 / §2.18.2 / §2.18.1` 및 코드베이스와 일치한다.

---

### API endpoint 충돌

- **[INFO]** `/api/users/me/enable-2fa` · `/api/users/me/confirm-2fa` 와 `/api/auth/2fa/setup` · `/api/auth/2fa/verify` 이중 게재
  - target 신규 식별자: `POST /api/auth/2fa/setup`, `POST /api/auth/2fa/verify` (`§5` 엔드포인트 표)
  - 기존 사용처: `spec/2-navigation/9-user-profile.md` 라인 304-305 — `/api/users/me/enable-2fa` 와 `/api/users/me/confirm-2fa` 가 각각 `canonical: POST /api/auth/2fa/setup`, `canonical: POST /api/auth/2fa/verify` 로 주석 처리된 채 별도 행으로 존재
  - 상세: 엔드포인트 자체는 `9-user-profile.md` 가 "canonical 은 auth spec" 임을 명시해 의미 충돌은 없다. 그러나 두 문서에 각각 별도 표기가 남아 있어 라우트가 실제로 두 개인지 하나의 alias 인지 불명확하다.
  - 제안: `9-user-profile.md §6.1` 표에서 `/api/users/me/enable-2fa` · `/api/users/me/confirm-2fa` 행을 삭제하거나 "alias 미지원, 위 canonical endpoint 를 직접 사용" 주석으로 대체해 이중 정의를 제거한다.

충돌 수준이 높은 endpoint 신규 정의는 없음. target 이 정의하는 `GET /api/auth/2fa/webauthn/availability`, `POST /api/auth/2fa/webauthn/register/options` 등 WebAuthn 엔드포인트 계열은 다른 spec 문서(`10-auth-flow.md`, `data-flow/2-auth.md`)에서 참조만 할 뿐 별도로 정의하지 않는다.

---

### 이벤트/메시지명 충돌

특이사항 없음. `login-history-pruner` BullMQ 큐 이름은 `spec/data-flow/1-audit.md §3`, `spec/5-system/16-system-status-api.md §1` 과 동일하게 사용되어 충돌 없다.

---

### 환경변수·설정키 충돌

특이사항 없음. target 이 정의하는 환경변수 4종은 `codebase/backend/src/common/config/webauthn.config.ts` 에서도 동일 이름으로 읽히고 있어 충돌 없다:
- `WEBAUTHN_RP_ID` — webauthn.config.ts 라인 39
- `WEBAUTHN_RP_NAME` — webauthn.config.ts 라인 41
- `WEBAUTHN_ORIGIN` — webauthn.config.ts 라인 40
- `WEBAUTHN_ALLOW_FALLBACK` — webauthn.config.ts 라인 42

`INVITATION_THROTTLE` 은 상수 이름(코드 내부 심볼, env var 아님)이며 `workspaces.controller.ts` 라인 30 과 일치한다.

---

### 파일 경로 충돌

특이사항 없음. target 파일 경로 `spec/5-system/1-auth.md` 는 기존 spec tree 에서 `1-` prefix로 이미 존재하고 있는 파일이다(신규 생성이 아닌 수정). 명명 컨벤션(`N-name.md`)과 일치한다.

---

### 에러 코드 충돌 추가 확인

- **[INFO]** `WEBAUTHN_DISABLED` · `INVALID_OPTIONS_TOKEN` · `CHALLENGE_INVALID` · `RECOVERY_CODE_INVALID` · `WEBAUTHN_VERIFY_FAILED` 는 target §5 엔드포인트 표에서 처음 등장하는 신규 에러 코드다.
  - 기존 사용처: 다른 spec 문서에서 이 코드들을 참조하는 곳은 발견되지 않는다.
  - 상세: 코드 형식은 `UPPER_SNAKE_CASE` 로 `spec/conventions/error-codes.md §1` 원칙과 일치한다. 기존 `WEBAUTHN_INVALID` / `WEBAUTHN_COUNTER_REGRESSION` (`data-model §2.18.2`, `data-flow/1-audit.md §1.2`)은 `failure_reason` 필드값이고, 신규 `WEBAUTHN_INVALID`(인증 실패 응답 코드)·`WEBAUTHN_COUNTER_REGRESSION`(LoginHistory `failure_reason`)은 각각 다른 레이어에서 동명으로 쓰인다.
  - 제안: 두 레이어(API 응답 error.code vs LoginHistory.failure_reason)에서 `WEBAUTHN_INVALID` 가 동일 문자열을 쓰는 것이 현재 스펙상 의도적 설계임을 `spec/conventions/error-codes.md` 혹은 target §4.3 주석에 명시하면 향후 혼선을 방지한다.

---

### 감사 액션명 충돌

특이사항 없음. target §4.1 이 도입하는 신규 Planned 액션 (`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`, `model_config.*`)은 `spec/data-flow/1-audit.md §1` 에서 이미 동일 명칭으로 미구현 상태가 기록되어 있어 중복이지 충돌이 아니다.

---

## 요약

`spec/5-system/1-auth.md` 가 도입하는 신규 식별자 중 기존 사용처와 의미가 충돌하는 항목은 발견되지 않았다. 유일한 주의 사항은 `spec/2-navigation/9-user-profile.md §6.1` 에 TOTP 활성화 관련 alias 엔드포인트(`/api/users/me/enable-2fa`, `/api/users/me/confirm-2fa`)가 "canonical은 auth spec" 주석과 함께 이중으로 열거되어 있는 것으로, 이는 의미 충돌이 아닌 문서 중복 표기에 가깝다. 환경변수·에러코드·엔티티명·파일 경로 모두 기존 스펙 및 코드베이스와 일관되게 정렬되어 있다.

---

## 위험도

NONE

---

STATUS: SUCCESS
