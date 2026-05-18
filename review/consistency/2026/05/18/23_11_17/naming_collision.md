# 신규 식별자 충돌 검토 — naming_collision

검토 모드: 구현 착수 전 검토 (--impl-prep)
Target 영역: `codebase/backend/src/modules/auth`
검토 일자: 2026-05-18

---

## 발견사항

### 발견사항 1

- **[CRITICAL]** `LoginChallengeDto` — 기존 DTO 와 신규 WebAuthn 분기 로직 간 필드 충돌
  - target 신규 식별자: spec `plan/in-progress/2fa-webauthn.md` §4 및 auth spec §1.4.2 가 `/auth/login` 응답에 `{ requires2fa, methods, challengeToken, requiresTotp? }` 구조를 명시
  - 기존 사용처: `codebase/backend/src/modules/auth/dto/responses/auth-response.dto.ts:11-16` 의 `LoginChallengeDto` 는 `requiresTotp: boolean` + `challengeToken: string` 만 보유. `auth.service.ts:226` 에서 반환 타입은 `{ requiresTotp: true; challengeToken: string }` — `requires2fa` 와 `methods` 필드가 **없음**. `auth.controller.ts:194-200` 도 `requiresTotp` 만 내려보냄
  - 상세: spec §1.4.2 가 명확히 정의한 신규 필드 `requires2fa` (boolean), `methods: ['webauthn'|'totp']` 가 현재 코드베이스 DTO / 서비스 / 컨트롤러 어디에도 존재하지 않는다. WebAuthn 구현 시 이 필드들을 추가해야 하는데, 기존 `LoginChallengeDto` + 서비스 반환 타입 + 컨트롤러 응답 직렬화 코드 세 곳을 동시에 변경해야 충돌 없이 작동한다. 한 곳만 바꾸면 타입 불일치로 런타임 오류 또는 Swagger 문서 불일치가 생긴다.
  - 제안: `LoginChallengeDto` 를 `requires2fa: boolean`, `methods: string[]`, `challengeToken: string`, `requiresTotp?: boolean` 로 확장하고, `auth.service.ts` 반환 타입과 `auth.controller.ts` 응답 객체를 동시에 갱신한다. 단, `requiresTotp` 는 deprecated 필드로 두 마이너 버전 유지 (spec §1.4.2 정책).

---

### 발견사항 2

- **[CRITICAL]** `LoginHistoryEvent` 타입 — `webauthn_failed` 누락으로 DB CHECK 제약·TypeORM 불일치
  - target 신규 식별자: spec `plan/in-progress/2fa-webauthn.md` §3 이 V058 마이그레이션으로 `chk_login_history_event` CHECK 제약에 `webauthn_failed` 를 추가 + data-model §2.18.2 에 이미 명시됨
  - 기존 사용처: `codebase/backend/src/modules/auth/entities/login-history.entity.ts:12-18` 의 `LoginHistoryEvent` 타입 유니온은 `'login_success' | 'login_failed' | 'totp_failed' | 'logout' | 'session_revoked' | 'token_reuse_detected'` — `webauthn_failed` **없음**
  - 상세: V058 마이그레이션이 DB CHECK 제약에 `webauthn_failed` 를 추가하더라도, TypeScript 타입에 이 값이 없으면 `LoginHistoryService.record()` 호출 시 타입 오류가 발생하거나 타입 단언(as any)을 강제한다. WebAuthn 인증 실패 기록 (`WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION`) 로직이 컴파일 타임에 타입 오류 없이 호출되려면 entity 파일과 마이그레이션이 동시에 갱신되어야 한다.
  - 제안: V058 마이그레이션과 동일한 PR 에서 `login-history.entity.ts` 의 `LoginHistoryEvent` 에 `| 'webauthn_failed'` 를 추가한다. `login-history.service.ts` 의 `record()` 시그니처 및 모든 call-site 의 타입 검사도 함께 통과시킨다.

---

### 발견사항 3

- **[WARNING]** `webauthn.config.ts` — 신규 config 파일의 환경변수 키 `WEBAUTHN_ORIGIN` 이 기존 `CORS_ORIGINS` 와 의미 중복 가능
  - target 신규 식별자: `WEBAUTHN_RP_ID`, `WEBAUTHN_RP_NAME`, `WEBAUTHN_ORIGIN` (plan §1 디자인 결정, spec §1.4.3). `WEBAUTHN_ORIGIN` 은 "콤마 구분 허용 origin 목록 — 같은 RP 의 multi-origin 지원"
  - 기존 사용처: `codebase/backend/.env.example` 에 `CORS_ORIGINS` (콤마 구분 여러 도메인 허용, 미설정 시 `FRONTEND_URL` fallback). `codebase/backend/src/common/config/app.config.ts` 가 이를 읽어 CORS + WebSocket gateway 에 적용
  - 상세: `WEBAUTHN_ORIGIN` 과 `CORS_ORIGINS` 는 값이 동일할 수 있지만 목적이 다르다 — `CORS_ORIGINS` 는 HTTP 레이어 CORS 정책, `WEBAUTHN_ORIGIN` 은 WebAuthn `verifyAuthenticationResponse` 의 `expectedOrigin` 파라미터용. 운영자가 두 환경변수를 독립 관리해야 하는 이유가 불명확하면 한쪽만 설정하는 실수가 발생할 수 있다. `.env.example` 에 `WEBAUTHN_ORIGIN` 설명이 없으면 셀프 호스팅 운영자가 누락할 가능성이 있다.
  - 제안: `codebase/backend/.env.example` 에 `WEBAUTHN_*` 변수 블록을 추가하고, `WEBAUTHN_ORIGIN` 과 `CORS_ORIGINS` 의 차이를 inline 주석으로 명시한다. `webauthn.config.ts` 는 기존 `app.config.ts` 패턴(`registerAs('webauthn', ...)`)을 그대로 따르되, `common/config/index.ts` 에도 export 를 추가해야 `ConfigModule.forRoot` 에 로드된다 (`common/config/index.ts` 에 현재 없음 — 추가 누락 시 config 미주입으로 런타임 오류).

---

### 발견사항 4

- **[WARNING]** `WebAuthnRegisterOptionsDto` / `WebAuthnRegisterVerifyDto` 등 신규 response DTO 명 — 기존 `TotpVerifyDto` 와 의미적 유사성으로 혼동 가능
  - target 신규 식별자: plan §4 에서 생성 예정인 `dto/responses/webauthn-response.dto.ts` 내 `WebAuthnRegisterVerifyDto`, `WebAuthnRecoveryCodesDto`
  - 기존 사용처: `auth-response.dto.ts:29` 의 `TotpVerifyDto` 는 `{ recoveryCodes: string[] }` 를 반환. `WebAuthnRegisterVerifyDto` 도 첫 등록 시 `recoveryCodes: string[]` 를 포함할 것으로 예상됨 (spec §1.4.4, plan §4)
  - 상세: `TotpVerifyDto.recoveryCodes` 와 새로 만들 `WebAuthnRegisterVerifyDto.recoveryCodes` 는 동일 필드명을 사용하지만 **서로 다른 복구 코드 풀** (spec §1.4.1 — TOTP 복구 코드 vs WebAuthn 복구 코드)이다. 클라이언트 코드에서 두 응답을 혼용하거나 동일 타입으로 매핑하면 복구 코드를 교차 사용하는 버그로 이어질 수 있다. 또한 `WebAuthnRecoveryCodesDto` (재발급 응답) 와 `WebAuthnRegisterVerifyDto` (첫 등록 응답) 가 둘 다 `recoveryCodes` 를 가지므로 프론트엔드 타입 정의에서 중복이 발생할 수 있다.
  - 제안: `WebAuthnRegisterVerifyDto` 에 `webauthnRecoveryCodes: string[]` 처럼 `webauthn` prefix 를 붙여 TOTP `recoveryCodes` 와 명시적으로 구분한다. 또는 두 DTO 가 동일 필드명을 쓰더라도 JSDoc 주석으로 "TOTP 복구 코드 풀과 별개" 임을 명시하고 프론트엔드 API 클라이언트에서 타입 별칭으로 구분한다.

---

### 발견사항 5

- **[WARNING]** `optionsToken` JWT `kind` 값 — `mfa_challenge` (기존 JWT claim) 와 `webauthn_register` / `webauthn_auth` 의 naming 패턴 불일치
  - target 신규 식별자: spec §1.4.4 및 `plan §4` 가 정의한 optionsToken payload: `{ kind: 'webauthn_register' | 'webauthn_auth', sub, challenge, exp }`. 기존 challenge token JWT: `{ sub, mfa_challenge: true, rememberMe, exp }` (`auth.service.ts:311-314`)
  - 기존 사용처: `auth.service.ts:311-314` 의 challengeToken 은 `kind` 없이 `mfa_challenge: true` 클레임을 사용. optionsToken 에는 `kind` 필드를 새로 도입
  - 상세: 두 JWT 가 다른 클레임 패턴을 사용한다. challengeToken 은 `mfa_challenge: true` (boolean flag), optionsToken 은 `kind: string` (enum 스타일). 교차 사용 방어를 위해 `loginWithTotp` 는 현재 `mfa_challenge` 클레임으로 토큰 종류를 식별하는데, WebAuthn `authenticate/verify` 는 `challengeToken` + `optionsToken` 모두 검증해야 하므로 두 토큰의 클레임 식별 방식이 혼재한다. 이는 `verifyAuthentication` 구현 시 `kind !== 'webauthn_auth'` + `mfa_challenge !== true` 를 각각 별도로 검사하는 코드가 되어 실수 가능성이 있다.
  - 제안: challengeToken 도 `kind: 'mfa_challenge'` 로 통일하는 것을 검토한다. 이미 배포된 클라이언트가 `mfa_challenge` boolean 을 읽고 있을 수 있으므로 `mfa_challenge: true` 는 호환성 유지로 병기하고, 새 optionsToken 에는 `kind` 단일 패턴을 사용한다. 최소한 `WebAuthnService.generateAuthenticationOptions` 내부에서 `challengeToken` 의 kind/claim 검증 로직을 주석으로 문서화한다.

---

### 발견사항 6

- **[INFO]** `V057` / `V058` 마이그레이션 번호 — 현재 최고 번호 V056 이므로 V057 은 사용 가능하지만, `replay-rerun` 등 다른 in-progress plan 과 경쟁 위험 명시
  - target 신규 식별자: `V057__webauthn_credentials_and_recovery.sql`, `V058__login_history_webauthn_failed_event.sql`
  - 기존 사용처: `codebase/backend/migrations/` 내 최고 번호는 `V056__notification_active_partial_index.sql` (확인됨). V057·V058 은 현재 미점유
  - 상세: plan §3 에서 이미 "다른 worktree 가 동일 번호를 점유했으면 다음 정수로 시프트" 를 명시하고 있어 인식은 되어 있다. 그러나 `replay-rerun.md` 등 동시 진행 중인 plan 이 V057 을 선점할 경우 본 plan 이 번호를 재조정해야 한다. 이는 직접적인 충돌보다는 선점 위험에 대한 주의 환기다.
  - 제안: 구현 착수 직전 plan §3 의 체크리스트 (`ls migrations | sort -V | tail -1`) 를 실행해 번호를 재확인하고 이상이 없으면 진행한다. 이미 plan 에 절차가 있으므로 추가 조치 불필요.

---

### 발견사항 7

- **[INFO]** `webauthn-credential.entity.ts` 가 `auth.module.ts` `entities` 배열에 등록되지 않으면 TypeORM 스캔 누락
  - target 신규 식별자: `codebase/backend/src/modules/auth/entities/webauthn-credential.entity.ts` (신규 파일, plan §4)
  - 기존 사용처: `codebase/backend/src/modules/auth/auth.module.ts` — 현재 `RefreshToken`, `LoginHistory` 등 기존 entity 만 imports 배열에 등록되어 있을 것으로 예상됨
  - 상세: plan §4 가 "app.module.ts 의 entities 배열에 추가" 를 명시하고 있으나, NestJS TypeORM 패턴에서는 모듈 단위 `TypeOrmModule.forFeature([...entities])` 에 등록하는 것이 관례다. 누락 시 Repository 주입이 실패하거나 테이블이 인식되지 않는다. "app.module.ts" 라는 표현이 모듈 레벨 등록과 혼동될 여지가 있다.
  - 제안: `auth.module.ts` 의 `TypeOrmModule.forFeature([..., WebAuthnCredential])` 에 추가하고, app.module.ts 의 entities 배열(TypeORM forRootAsync 설정)에도 포함되어야 하는지 기존 패턴을 확인해 동일하게 처리한다. plan §4 의 표현("app.module.ts 의 entities 배열") 을 구체화하는 것을 권장한다.

---

## 요약

target 영역(`codebase/backend/src/modules/auth`)에 WebAuthn 2FA 를 추가하는 구현 계획에서 가장 심각한 충돌은 두 가지다. 첫째, `/auth/login` 응답 타입(`LoginChallengeDto`)과 `auth.service.ts` / `auth.controller.ts` 가 spec 에서 새로 정의한 `requires2fa` / `methods` 필드를 전혀 보유하지 않아, WebAuthn 분기 로직을 추가하면 기존 DTO 와 즉시 충돌한다. 둘째, `LoginHistoryEvent` TypeScript 타입 유니온에 `webauthn_failed` 가 없어 V058 마이그레이션이 DB CHECK 제약을 확장하더라도 애플리케이션 레이어에서 타입 오류가 발생한다. 이 두 항목은 컴파일 오류 또는 런타임 불일치를 직접 유발하므로 구현 착수 전에 반드시 해소해야 한다. 그 외 `WEBAUTHN_ORIGIN` 환경변수의 `.env.example` 누락, 신규 response DTO 의 `recoveryCodes` 필드명 혼동 가능성, optionsToken JWT `kind` 클레임 패턴 불일치는 보완이 권장되지만 즉각적 차단 사안은 아니다.

## 위험도

HIGH
