# 2FA WebAuthn 추가

> 작성일: 2026-05-11
> 상위 인덱스: [`0-unimplemented-overview.md`](./0-unimplemented-overview.md) §A
> 선행 plan: `plan/complete/feature-roadmap/06-2fa.md` (TOTP + 복구 코드 ✅)

## 배경

PRD 5 §2 NF-SC-10:

> **NF-SC-10** 2FA(Two-Factor Authentication) 지원 — 권장 — ✅ (TOTP + 복구 코드 10개. WebAuthn은 후속)

TOTP 인증 + 복구 코드는 ✅. WebAuthn (Passkey / 보안 키 등) 은 후속 작업으로 남아 있음.

## 관련 문서

- `prd/5-non-functional.md` §2 NF-SC-10
- `spec/5-system/1-auth.md` (인증 / 2FA 흐름)
- `spec/2-navigation/9-user-profile.md` (보안 설정 화면)
- `plan/complete/feature-roadmap/06-2fa.md` (TOTP 구현 history)
- 코드: `codebase/backend/src/modules/auth/two-factor*/`, `codebase/frontend/src/app/(main)/profile/security/`

## 작업 단위

### 1. 디자인 결정

- [ ] WebAuthn 라이브러리 선택 — `@simplewebauthn/server` + `@simplewebauthn/browser` 가 표준. 사용자 합의 필요
- [ ] **rpID / origin** — SaaS 도메인 vs. 셀프 호스팅 도메인 모두 지원해야 하므로 환경변수로 분리
- [ ] **사용자 흐름** — TOTP 만 / WebAuthn 만 / 둘 다 등록한 경우의 로그인 시 인증 옵션 우선순위
- [ ] **Passkey 다중 등록** — 사용자당 N개 인증기 등록 허용 (모바일 + 데스크톱 + 보안 키)
- [ ] **복구 코드** — TOTP 와 동일하게 별도 복구 코드 발급 vs. 공통 복구 코드 사용

### 2. 데이터 모델 / 마이그레이션

- [ ] `WebAuthnCredential` 엔티티 — `user_id`, `credential_id` (base64url), `public_key`, `counter`, `transports`, `device_name?`, `last_used_at?`, `created_at`
- [ ] 마이그레이션 추가

### 3. 백엔드 구현 (TDD)

- [ ] 등록 흐름: `POST /api/v1/auth/2fa/webauthn/register/options` → challenge 생성 + 세션 저장 → 클라이언트가 `navigator.credentials.create()` → `POST /api/v1/auth/2fa/webauthn/register/verify` → credential 저장
- [ ] 인증 흐름: 로그인 후 2FA 단계에서 `POST /api/v1/auth/2fa/webauthn/authenticate/options` → 클라이언트 `navigator.credentials.get()` → `POST /api/v1/auth/2fa/webauthn/authenticate/verify` → JWT 발급
- [ ] credential 관리 — 목록 조회 / 이름 수정 / 삭제 API
- [ ] counter 검증 (replay 방어) + 단위 테스트
- [ ] 통합 테스트 (등록 / 인증 / counter mismatch / 복구 코드 fallback)

### 4. 프론트엔드 구현 (TDD)

- [ ] 보안 설정 페이지에 "Passkey / 보안 키" 섹션 추가 — 등록 / 목록 / 이름 변경 / 삭제 UI
- [ ] 로그인 후 2FA 단계 — TOTP / Passkey 선택 UI (사용자가 등록한 인증기에 따라)
- [ ] 브라우저 호환성 안내 (Safari, Chrome, Firefox 의 WebAuthn 지원 차이)
- [ ] i18n (ko/en)
- [ ] 단위 테스트 + e2e (Playwright Virtual Authenticator 활용)

### 5. spec / PRD 갱신

- [ ] `prd/5-non-functional.md` §2 NF-SC-10 상태 — TOTP + WebAuthn 모두 ✅
- [ ] `spec/5-system/1-auth.md` 에 WebAuthn 흐름 추가
- [ ] `spec/2-navigation/9-user-profile.md` 보안 섹션 갱신

### 6. 매뉴얼

- [ ] `codebase/frontend/src/content/docs/` 보안 가이드에 Passkey 등록·사용법 추가

### 7. REVIEW

- [ ] `ai-review` 실행 → Security 중심 (counter 검증, replay 방어, rpID 정합성, 복구 코드 fallback)

## 수용 기준

- 사용자가 Passkey/보안 키를 등록·관리·삭제 가능
- 로그인 시 TOTP 또는 Passkey 중 선택해 2FA 통과 가능
- counter 검증·복구 코드 fallback 회귀 잠금
- ai-review Critical/Warning 0

## 의존성·리스크

- **의존**: TOTP 2FA 가 이미 ✅이므로 동일 모듈 확장
- **리스크**:
  - 셀프 호스팅 환경에서 rpID/origin 설정 실수 시 등록·인증 모두 실패 — 환경변수 검증 필수
  - 모바일 Safari 의 Passkey 흐름 차이 — 충분한 e2e/수동 검증 필요
