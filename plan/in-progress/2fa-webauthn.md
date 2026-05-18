---
worktree: 2fa-webauthn-impl
started: 2026-05-18
owner: developer
---

# 2FA WebAuthn 추가

> 작성일: 2026-05-11 · 디자인 결정 확정: 2026-05-18
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/06-2fa.md` (TOTP + 복구 코드 ✅)

## 배경

`spec/5-system/_product-overview.md` §2 NF-SC-10:

> **NF-SC-10** 2FA(Two-Factor Authentication) 지원 — 권장 — ✅ (TOTP + 복구 코드 10개. WebAuthn은 후속)

TOTP 인증 + 복구 코드는 ✅. WebAuthn (Passkey / 보안 키 등) 은 후속 작업으로 남아 있음.

## 관련 문서

- `spec/5-system/_product-overview.md` §2 NF-SC-10
- `spec/5-system/1-auth.md` (인증 / 2FA 흐름)
- `spec/2-navigation/9-user-profile.md` (보안 설정 화면)
- `spec/data-flow/2-auth.md` (인증 데이터 흐름)
- `plan/complete/feature-roadmap/06-2fa.md` (TOTP 구현 history)
- 코드: `codebase/backend/src/modules/auth/totp.service.ts`, `codebase/frontend/src/app/(main)/profile/security/`

## 작업 단위

### 1. 디자인 결정 (2026-05-18 확정)

- [x] **WebAuthn 라이브러리** — `@simplewebauthn/server` (백엔드) + `@simplewebauthn/browser` (프론트). 사실상 Node WebAuthn 의 표준 구현이며 최신 spec (FIDO2 L3) 추적이 빠르다.
- [x] **rpID / origin 환경변수 분리** — 셀프 호스팅 운영에서 도메인이 달라지므로 `WEBAUTHN_RP_ID` (예: `clemvion.example.com`) / `WEBAUTHN_RP_NAME` (사용자에게 노출될 표시 이름, 기본 `Clemvion`) / `WEBAUTHN_ORIGIN` (콤마 구분 허용 — 동일 RP 의 multi-origin 지원) 으로 분리. 모두 누락 시 `FRONTEND_URL` 로 best-effort 폴백 + warn 로그.
- [x] **사용자 흐름 — WebAuthn 우선, TOTP fallback**
  - 사용자는 TOTP / WebAuthn 둘 다 등록할 수 있다. 등록 자체는 독립적.
  - 로그인 2FA 단계 분기:
    - WebAuthn credential 이 1개 이상 등록 → WebAuthn 화면만 노출. TOTP 코드 입력란은 숨김.
    - WebAuthn credential 이 0개 AND `twoFactorEnabled = true` → TOTP 화면.
    - 둘 다 없으면 2FA 단계 건너뜀.
  - WebAuthn 에 실패한 경우 "복구 코드 사용" 링크로 webauthn 전용 복구 코드 입력 화면을 노출. TOTP 화면으로는 자동 fallback 하지 않는다 (사용자가 명시적으로 보안설정에서 WebAuthn 을 삭제한 뒤 재로그인하면 TOTP 가 노출됨).
- [x] **Passkey 다중 등록 허용** — 사용자당 N개 credential 등록 가능. 등록 시 `excludeCredentials` 로 동일 인증기 중복 차단. 각 credential 은 `device_name` (사용자 입력) + `aaguid` (인증기 모델) + `last_used_at` 메타를 갖는다.
- [x] **복구 코드 — WebAuthn 전용 별도 발급** — TOTP 의 `totp_recovery_codes` 와 분리해 `webauthn_recovery_codes` 컬럼 (TEXT[]) 으로 별도 보관. 첫 credential 등록 verify 성공 시 10개 발급 (TOTP 와 동일 포맷 `xxxx-xxxx-xxxx`). 모든 credential 삭제 시 컬럼 NULL 로 비움. 사용자가 보안 설정에서 명시적으로 "복구 코드 재발급" 가능 (기존 미사용 코드 폐기).

### 2. spec / PRD 갱신 — 구현 착수 **이전** 에 완료

CLAUDE.md 의 "단일 진실 원칙" 에 따라 spec 을 먼저 정정한 뒤 코드를 짠다. consistency-check (--spec) BLOCK 해소가 이 단계 산출물이다.

- [x] `spec/5-system/_product-overview.md` §2 NF-SC-10 — `TOTP + WebAuthn 모두 ✅` 로 갱신
- [x] `spec/5-system/1-auth.md` §1.4 — TOTP/WebAuthn 두 방식 + 우선순위 규칙 + 별도 복구 코드 + 환경변수 + 흐름 명시. Rationale 1.4.A·B·C·D 추가
- [x] `spec/5-system/1-auth.md` §5 API 표 — TOTP canonical + WebAuthn endpoints 추가
- [x] `spec/5-system/1-auth.md` §4.3 LoginHistory — `webauthn_failed` 추가
- [x] `spec/5-system/1-auth.md` §2.3 강제 종료 재인증 — WebAuthn 케이스 추가
- [x] `spec/2-navigation/9-user-profile.md` §2.2 보안 표 + §6.1 API 표 갱신 (canonical 은 인증 spec §5 로 위임)
- [x] `spec/2-navigation/10-auth-flow.md` §3.2 / §3.4 / §8 — `verify-2fa` → `login/totp` + `tempToken` → `challengeToken` 정정 + WebAuthn 화면 추가
- [x] `spec/data-flow/2-auth.md` §1.2 — TOTP 가정 sequence 를 WebAuthn 우선 분기 sequence 로 갱신. `totpToken` → `challengeToken` 정정. §3 데이터 변경 표에 webauthn_credential / webauthn_recovery_codes 행 추가
- [x] `spec/1-data-model.md` §2.1 User — `two_factor_secret`, `totp_recovery_codes`, `webauthn_recovery_codes` 행 추가 (세 컬럼 모두 SHA-256 해시 배열 명시)
- [x] `spec/1-data-model.md` §2.18.2 LoginHistory — `webauthn_failed` enum + `chk_login_history_event` 제약명 명시
- [x] `spec/1-data-model.md` §2.21 WebAuthnCredential — 신규 엔티티 + challenge stateless JWT 설명. 기존 §2.21 AssistantMessage → §2.22 로 시프트
- [x] `spec/1-data-model.md` §3 인덱스 표 — `webauthn_credential (user_id)`, `webauthn_credential (credential_id) UNIQUE` 추가
- [ ] `spec/1-data-model.md` §1 ERD 다이어그램 — `WebAuthnCredential` (User 1:N) 관계 반영

### 3. 데이터 모델 / 마이그레이션

> **전제**: 본 단계 진입 직전 `consistency-check --impl-prep` 가 PASS 되어야 한다 (§7 첫 항목). plan §2 의 spec 갱신이 미완 상태면 차단.

> ⚠️ **착수 직전 max(V) 재확인 필수**:
> 1. `git fetch origin main && git rebase origin/main`
> 2. `ls codebase/backend/migrations | grep -E '^V[0-9]+__' | sort -V | tail -1` 로 V057 이 비어있는지 확인
> 3. `python3 scripts/check-migration-versions.py --base origin/main` 가드 통과 확인 (`spec/conventions/migrations.md §6`)
> 4. e2e dry-run (`make e2e-backend` 또는 migrate 컨테이너 단독 기동 — `migrations.md §5`)
> 5. 다른 worktree (`replay-rerun.md` 등) 가 동일 번호를 점유했으면 다음 정수로 시프트 + plan 본문도 갱신

- [ ] `V057__webauthn_credentials_and_recovery.sql` — `webauthn_credential` 테이블 신설 + `user.webauthn_recovery_codes` 컬럼 추가 + 인덱스 2개. 단일 트랜잭션 (CONCURRENTLY 없음) → `.conf` 불필요.
  - 컬럼: `id UUID PK / user_id UUID FK ON DELETE CASCADE / credential_id TEXT UNIQUE (base64url) / public_key BYTEA (CBOR-COSE) / counter BIGINT NOT NULL DEFAULT 0 / transports TEXT[] / aaguid UUID NULL / device_name VARCHAR(100) NULL / last_used_at TIMESTAMPTZ NULL / created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  - 인덱스: `idx_webauthn_credential_user (user_id)`, `idx_webauthn_credential_credid (credential_id)` UNIQUE
  - `ALTER TABLE "user" ADD COLUMN webauthn_recovery_codes TEXT[]` + 코멘트 (SHA-256 해시 배열, 사용 시 항목 제거)
  - 하단에 `-- DOWN:` 주석으로 `DROP TABLE` + `DROP COLUMN` 명시
- [ ] `V058__login_history_webauthn_failed_event.sql` — `chk_login_history_event` CHECK 제약을 DROP + ADD (단일 statement, NOT VALID/VALIDATE 패턴 불요 — 신규 enum 값은 기존 row 에 위배 없음). 별도 마이그레이션으로 분리해 V057 의 롤백 단위와 격리.

### 4. 백엔드 구현 (TDD)

- [ ] `@simplewebauthn/server` 의존성 추가 (`codebase/backend/package.json`, lock 갱신)
- [ ] `codebase/backend/src/common/config/webauthn.config.ts` 신설 — `registerAs('webauthn', () => ({ rpID, rpName, origins: string[] }))`. 환경변수 `WEBAUTHN_RP_ID` / `WEBAUTHN_RP_NAME` / `WEBAUTHN_ORIGIN` (콤마 구분). 누락 시 `FRONTEND_URL` 의 hostname/origin 으로 폴백 + warn 로그
- [ ] `codebase/backend/src/modules/auth/entities/webauthn-credential.entity.ts` — TypeORM entity, `app.module.ts` 의 entities 배열에 추가
- [ ] `codebase/backend/src/modules/auth/webauthn.service.ts` — `WebAuthnService`
  - `generateRegistrationOptions(userId)` → options + optionsToken (`kind: webauthn_register`, exp 5분)
  - `verifyRegistration(userId, optionsToken, response)` → credential INSERT + 첫 등록 시 복구 코드 10개 발급 (해시 저장, 평문 반환)
  - `generateAuthenticationOptions(userId)` → options + optionsToken (`kind: webauthn_auth`)
  - `verifyAuthentication(userId, optionsToken, response)` → counter 갱신 + LoginHistory `login_success`. counter 역행 시 row 삭제 + LoginHistory `webauthn_failed`(`WEBAUTHN_COUNTER_REGRESSION`) + 401 응답 (spec/5-system/1-auth.md §5 와 일치 — 인증 실패는 401)
  - `verifyRecoveryCode(userId, code)` → 해시 비교 + 사용 코드 제거
  - `listCredentials(userId)` / `renameCredential(userId, id, name)` / `deleteCredential(userId, id)` — 마지막 삭제 시 `webauthn_recovery_codes` NULL 화
  - `regenerateRecoveryCodes(userId)` — 비밀번호 재확인 + 새 10개 발급
- [ ] `codebase/backend/src/modules/auth/dto/webauthn.dto.ts` — request DTO + class-validator
- [ ] `codebase/backend/src/modules/auth/dto/responses/webauthn-response.dto.ts` — response DTO (`WebAuthnRegisterOptionsDto`, `WebAuthnRegisterVerifyDto`, `WebAuthnAuthOptionsDto`, `WebAuthnCredentialDto`, `WebAuthnRecoveryCodesDto`). `swagger.md §5-1·§5-4` 준수
- [ ] `auth.controller.ts` 에 endpoints 추가 (§spec 5-system/1-auth.md §5 와 1:1 대응)
  - `/api/auth/2fa/webauthn/register/options` · `/verify` (JWT 필수)
  - `/api/auth/2fa/webauthn/authenticate/options` · `/verify` · `/recovery` (`@Public`, 본문에 `challengeToken` 필수)
  - `/api/auth/2fa/webauthn/credentials` GET / `:id` PATCH (200) / DELETE (204) (JWT 필수). `:id` 는 `@ApiParam({ name: 'id', format: 'uuid' })` 명시
  - `/api/auth/2fa/webauthn/recovery-codes/regenerate` (JWT 필수 + 비밀번호 재확인)
  - 모두 Swagger annotation (`@ApiOperation`, `ApiOkWrappedResponse`, `@ApiBadRequestResponse`/`@ApiUnauthorizedResponse` 등 error response decorator — `Response` suffix 필수, `spec/conventions/swagger.md §2-4` 준수)
- [ ] `auth.service.ts` `/auth/login` 응답 진화
  - `{ requires2fa: true, methods: ['webauthn'] | ['totp'], challengeToken, requiresTotp? }` 반환
  - `requiresTotp` 는 backward compat 필드 (`methods` 가 `totp` 포함이면 true). 두 마이너 버전 후 제거 (W-1 follow-up)
  - 우선순위 결정: WebAuthn credential count > 0 이면 `methods = ['webauthn']` (TOTP 안 노출)
- [ ] anonymous 영역 보안 정책 (W-6)
  - `/authenticate/options` 와 `/authenticate/verify`, `/recovery` 는 `challengeToken` 만으로 사용자를 식별 — anonymous + email 흐름은 도입하지 않음. (challenge token JWT 가 `sub` 를 포함하므로 `/auth/login` 통과 후에만 진입 가능)
  - 이 경로는 기존 `/auth/login/totp` 와 동일하게 IP 단위 10 req/min throttle 적용
- [ ] LoginHistory `event` enum 에 `webauthn_failed` 추가 + `failure_reason` 으로 세분화 (`WEBAUTHN_INVALID`, `WEBAUTHN_COUNTER_REGRESSION`)
- [ ] 단위 테스트
  - `webauthn.service.spec.ts` — 등록/인증 옵션 발급, optionsToken kind 검증, counter 역행 감지, 복구 코드 1회성, 마지막 credential 삭제 시 recovery 정리
  - `auth.controller.spec.ts` — 4개 신규 endpoint group + login 응답 변화 (TOTP-only vs WebAuthn-only vs 둘 다)
- [ ] 통합/e2e 테스트 `webauthn-2fa.e2e-spec.ts`
  - `@simplewebauthn/server` 의 `verifyRegistrationResponse` / `verifyAuthenticationResponse` 는 라이브로 동작. 클라이언트 측 navigator.credentials 응답은 SoftWebAuthnDevice 합성 (Ed25519 키 쌍 생성, attestation/assertion 직접 서명 → base64url 직렬화). 라이브러리 직접 의존 대신 helper 구현
  - 시나리오: 등록 → 인증 → counter 갱신 검증 → counter 역행 시 401·credential 삭제 → 복구 코드 fallback → 마지막 credential 삭제 시 recovery 정리

### 5. 프론트엔드 구현 (TDD)

- [ ] `@simplewebauthn/browser` 의존성 추가 (`codebase/frontend/package.json`)
- [ ] `lib/api/auth.ts` 에 webauthn wrapper 추가 (`registerOptions/verify`, `authenticateOptions/verify`, `recovery`, credential 관리)
- [ ] login 응답 타입 진화: `LoginResponseData` 에 `{ requires2fa, methods, challengeToken, requiresTotp? }` 추가, 기존 `requiresTotp` 분기는 호환 처리
- [ ] `app/(main)/profile/security/page.tsx` 에 "Passkey · 보안 키" 카드 추가
  - 미등록 상태: `[Passkey 등록]` 버튼 + 브라우저 호환성 안내 (`PublicKeyCredential` 미지원 시 disabled + 안내문)
  - 등록 상태: credential 목록 (device_name 인라인 편집, 마지막 사용 — `formatDate(value, 'datetime')` 사용, 등록일, 삭제). 첫 등록 시 복구 코드 모달 (한 번만 표시, 복사 버튼). 복구 코드 재발급 버튼 (비밀번호 모달)
- [ ] `components/auth/login-form.tsx` 에서 `requires2fa` + methods 분기
  - methods 에 `webauthn` 포함 → WebAuthn 화면 (마운트 시 `startAuthentication` 자동 호출). 실패 시 "복구 코드 사용" 링크 → 입력 폼
  - methods 가 `totp` 만 → 기존 TOTP 화면 유지
  - 두 화면 모두 `[← 뒤로]` 로 비밀번호 화면 복귀 가능
- [ ] i18n (ko/en) — `profile.security.webauthn.*`, `auth.twoFactor.webauthn.*`, `auth.login.webauthn.*`. i18n key 추가 시 ko↔en parity 테스트 통과 확인 (`npm test -- i18n`)
- [ ] 단위 테스트 (RTL + jest) — security page 카드 동작, login-form WebAuthn 분기. `@simplewebauthn/browser` 는 mock
- [ ] e2e (Playwright Virtual Authenticator) — Chrome 기준. mobile Safari 는 manual follow-up

### 6. 매뉴얼

- [ ] `codebase/frontend/src/content/docs/07-workspace-and-team/` 하위 보안 가이드 (없으면 신규 `security-2fa.md`) 에 Passkey 등록/사용/복구 코드 추가 + WebAuthn 우선 정책·복구 코드 별도 발급 명시. 기존 섹션 안에 파일을 추가하므로 `SECTION_LABELS_BY_LOCALE` 재등록은 불요. 신규 섹션 디렉토리를 만들 경우 `locale.test.ts` coverage 통과 필요

### 7. REVIEW

- [x] `consistency-check --spec` 실행 (spec 수정 직전 의무) — 1차 BLOCK 해소 후 재실행하여 PASS 확보 (Critical 4 → 0)
- [ ] `consistency-check --impl-prep` 실행 (구현 직전 의무) — V057 번호 점유 확인 포함
- [ ] `ai-review` 실행 → Security 중심 (counter 검증, replay 방어, rpID/origin 정합성, 복구 코드 fallback, challenge JWT 만료, anonymous 흐름 차단)

### 8. Follow-up (본 PR 범위 밖 / 별 PR)

- [ ] `requiresTotp` deprecated 필드 제거 (두 마이너 버전 후)
- [ ] mobile Safari 실기기 수동 검증 + 가능 시 BrowserStack 통합
- [ ] WebAuthn-only 계정의 비밀번호 재설정 흐름 검토 (현재 TOTP 와 동일 — `passwordResetToken` 사용)

## 수용 기준

- 사용자가 Passkey/보안 키를 등록·관리·삭제 가능 (다중 credential)
- 등록된 WebAuthn 이 1개 이상이면 로그인 2FA 단계에서 WebAuthn 만 노출, 없으면 TOTP fallback
- WebAuthn 실패 시 사용자가 명시적으로 복구 코드 입력해 통과 가능 (별도 복구 코드)
- counter 검증·replay 방어·복구 코드 1회성 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: TOTP 2FA 가 이미 ✅이므로 동일 모듈 확장. V057·V058 마이그레이션 번호 점유 (다른 plan 과 직렬화)
- **리스크**:
  - 셀프 호스팅 환경에서 rpID/origin 설정 실수 시 등록·인증 모두 실패 — `webauthn.config.ts` 가 부재 시 warn 로그 + `FRONTEND_URL` 폴백
  - 모바일 Safari 의 Passkey 흐름 차이 — Playwright Virtual Authenticator 로 Chrome e2e 자동화하되 실기기 수동 검증은 §8 follow-up
  - `spec/1-data-model.md` 를 `spec-overview-followups-2026-05-18.md` 와 동시 수정 → 후자 plan 작업 시 본 plan merge 여부 확인 후 rebase 필요
