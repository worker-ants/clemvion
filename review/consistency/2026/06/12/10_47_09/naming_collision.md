# 신규 식별자 충돌 Check — `spec/5-system/1-auth.md`

## 발견사항

### 1. 요구사항 ID 충돌

해당 없음. target 문서(`spec/5-system/1-auth.md`)는 `id: auth` frontmatter를 사용한다. 전체 spec 폴더를 조회한 결과 `id: auth`를 사용하는 파일은 본 문서 하나뿐이며, 유사한 `id: auth-flow`(`spec/2-navigation/10-auth-flow.md`)와는 충분히 구분된다.

### 2. 엔티티/타입명 충돌

해당 없음. 아래 엔티티/필드 명은 target 이 정의하거나 참조하며, 모두 `spec/1-data-model.md`와 코드베이스에서 동일한 의미로 일관되게 사용된다.

- `emailVerifyToken`, `passwordResetToken` (User 필드)
- `totp_recovery_codes`, `webauthn_recovery_codes` (User 필드)
- `family_id` (RefreshToken 필드)
- `WebAuthnCredential` (§2.21)

### 3. API endpoint 충돌

target 이 §5에서 정의하는 endpoint들을 다른 spec 문서와 대조한 결과, 충돌은 없고 모두 target을 canonical SoT로 명시적 위임하고 있다.

- `spec/2-navigation/10-auth-flow.md` §API 표에서 일부 endpoint를 나열하되, "canonical 정의는 [auth spec §5](../5-system/1-auth.md)" 라고 명시적으로 위임한다.
- `spec/2-navigation/9-user-profile.md`의 `/api/users/me/enable-2fa`, `/api/users/me/confirm-2fa`는 canonical TOTP setup/verify endpoint의 alias 표기이며, "canonical: `POST /api/auth/2fa/setup`" 주석으로 target 우선을 명시한다.

### 4. 이벤트/메시지명 충돌

- **[INFO]** `webauthn_failed` LoginHistory 이벤트 — target과 일치하는 기존 정의 확인
  - target 신규 식별자: `webauthn_failed` (§4.3 LoginHistory 이벤트)
  - 기존 사용처: `spec/1-data-model.md` L656, `spec/data-flow/1-audit.md` L90-92, L157
  - 상세: 세 파일 모두 동일한 의미(WebAuthn 2FA 검증 실패 이벤트)로 일관 사용. 충돌 없음. target이 새로 도입한 것이 아니라 기존 정의를 참조·기술하는 형태다.

- **[INFO]** `login-history-pruner` BullMQ 큐명
  - target 신규 식별자: `login-history-pruner` 큐 (§4.3 Rationale 1.4.G)
  - 기존 사용처: `spec/data-flow/0-overview.md` L108, `spec/data-flow/1-audit.md` L140, `spec/data-flow/2-auth.md` L260-261, `spec/5-system/16-system-status-api.md` L31
  - 상세: 동일 의미로 일관 사용. 충돌 없음.

### 5. 환경변수·설정키 충돌

- **[INFO]** `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN`, `WEBAUTHN_ALLOW_FALLBACK`
  - target 신규 식별자: 위 4개 환경변수 (§1.4.3)
  - 기존 사용처: `codebase/backend/.env.example`, `codebase/backend/src/common/config/webauthn.config.ts`, 관련 테스트 파일 — 코드베이스에서 동일한 이름으로 이미 구현됨
  - 상세: target이 정의하는 env var명이 구현 코드와 완전히 일치. 충돌 없음. 다른 spec 문서에는 이 변수들이 등장하지 않아 교차 충돌 없음.

- **[INFO]** `JWT_SECRET`, `ENCRYPTION_KEY`, `OAUTH_STUB_MODE`, `LLM_STUB_MODE`, `MCP_ALLOW_INSECURE_URL`
  - target 신규 식별자: Production fail-closed 가드 Rationale 섹션에서 참조 (§Rationale "Production fail-closed 가드")
  - 기존 사용처: `spec/5-system/7-llm-client.md` §7.1, `spec/5-system/11-mcp-client.md` §3.2, `spec/conventions/secret-store.md` §4, `spec/data-flow/7-llm-usage.md` L26
  - 상세: 각 spec 문서에서 동일한 의미로 사용하고 있으며, target이 `assertProductionConfig` 단일 블록으로 응집하는 이유를 Rationale에 설명함. 의미 충돌 없음.

### 6. 감사 액션명 충돌

- **[INFO]** `auth_config.*` 감사 액션 (`auth_config.create`, `auth_config.update`, `auth_config.delete`, `auth_config.regenerate`, `auth_config.reveal`)
  - target 신규 식별자: §4.1 감사 액션 표
  - 기존 사용처: `spec/data-flow/1-audit.md` L53-57, `spec/2-navigation/6-config.md` L120, `spec/5-system/12-webhook.md` L368-369
  - 상세: 모든 문서에서 동일한 의미·동일한 표기로 일관 사용. 충돌 없음.

- **[INFO]** Planned 감사 액션 (`user.password_changed`, `user.2fa_enabled`, `user.2fa_disabled`, `model_config.*`, `workspace.*`, `member.*`, `workflow.*` 등)
  - target 신규 식별자: §4.1 Planned 표 + Rationale §4.1.A
  - 기존 사용처: `spec/data-flow/1-audit.md` L69 — "모두 미구현" 으로 동일 집합을 참조
  - 상세: target이 §4.1.A에서 `user.*` dot-prefix 통일 근거를 설명하며 표기를 확정하는 내용이고, `data-flow/1-audit.md`가 이를 그대로 반영하고 있어 일관됨. 충돌 없음.

### 7. 파일 경로 충돌

해당 없음. `spec/5-system/1-auth.md`는 기존 spec 구조의 `5-system/` 영역 내 `1-auth` 번호 문서이며, 명명 컨벤션(`N-name.md`)에 부합한다. 동일 경로의 다른 파일 없음.

### 8. 에러 코드 충돌

- **[INFO]** `invitation_not_found`, `invitation_expired`, `invitation_already_used`, `invitation_email_mismatch` (lower_snake_case 예외)
  - target 신규 식별자: §1.5.4 에러 코드 표
  - 기존 사용처: `spec/2-navigation/10-auth-flow.md` L117, `spec/2-navigation/9-user-profile.md` L197, `spec/data-flow/12-workspace.md` L84-86, L215, L222, L265
  - 상세: 모든 문서에서 동일한 의미로 사용. target 자체가 §1.5.4 주석에서 historical-artifact 예외임을 명시적으로 선언하고 `spec/conventions/error-codes.md §3` 레지스트리 등재로 정당화함. 의미 충돌 없음.

- **[INFO]** `WEBAUTHN_DISABLED`, `WEBAUTHN_VERIFY_FAILED`, `INVALID_OPTIONS_TOKEN`, `CHALLENGE_INVALID`, `RECOVERY_CODE_INVALID`, `WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION`
  - target 신규 식별자: §5 endpoint 표 에러 코드들
  - 기존 사용처: `spec/1-data-model.md` L661, `spec/data-flow/1-audit.md` L90 — `WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION`은 `failure_reason` 값으로 일관 사용
  - 상세: 의미 일치. 나머지(`WEBAUTHN_DISABLED` 등)는 target 에만 등장하며 다른 spec 에서 다른 의미로 사용된 사례 없음. 충돌 없음.

---

## 요약

`spec/5-system/1-auth.md`가 도입하거나 참조하는 식별자들(frontmatter id, 엔티티·필드명, API endpoint, 환경변수, 감사 액션명, 에러 코드, BullMQ 큐명) 전반에서 기존 사용처와의 의미 충돌이 발견되지 않았다. 관련 문서들(`spec/1-data-model.md`, `spec/data-flow/1-audit.md`, `spec/data-flow/2-auth.md`, `spec/2-navigation/10-auth-flow.md`, `spec/2-navigation/9-user-profile.md`, `spec/5-system/16-system-status-api.md`, `spec/conventions/secret-store.md` 등)이 target을 canonical SoT로 명시 위임하거나 동일 의미로 일관되게 참조하고 있다. lower_snake_case 초대 에러 코드는 target 내부에서 historical-artifact 예외로 선언·정당화되어 있어 기존 규약과의 충돌 리스크도 인지되고 처리된 상태다.

## 위험도

NONE
