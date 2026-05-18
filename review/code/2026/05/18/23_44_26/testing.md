# Testing 리뷰 — 2FA WebAuthn 구현 (spec 갱신 + consistency-check 결과)

리뷰 대상: 20개 파일 (consistency-check 결과 md/json + spec 문서 갱신)  
분석 관점: 테스트 존재 여부, 커버리지 갭, 엣지 케이스, Mock 적절성, 격리, 가독성, 회귀 테스트, 테스트 용이성

---

### 발견사항

- **[CRITICAL]** WebAuthn 핵심 보안 로직에 대한 단위 테스트 계획 부재
  - 위치: `plan/in-progress/2fa-webauthn.md` §4 백엔드 구현 전체 (리뷰 대상 파일들이 참조하는 plan)
  - 상세: consistency-check 결과(`review/consistency/2026/05/18/23_11_17/rationale_continuity.md`)는 `auth.service.ts`의 `login()` 메서드가 WebAuthn credential 존재 여부를 확인하지 않아 Rationale 1.4.D("TOTP 자동 fallback 금지")를 위반한다고 CRITICAL 으로 분류했다. 그런데 이 보안 로직은 정확히 단위 테스트가 가장 먼저 커버해야 하는 경로다. `login()` 에 WebAuthn credential 조회 분기를 추가할 때 다음 케이스를 테스트로 강제해야 한다: (a) WebAuthn credential ≥ 1인 사용자에게 `methods: ['webauthn']` 응답이 내려지는지, (b) 동일 사용자가 TOTP 경로로 직접 시도할 때 `401 TOTP_FORBIDDEN` 이 반환되는지. 현재 변경 세트에 이에 대응하는 테스트 추가 계획이 없다.
  - 제안: `plan/in-progress/2fa-webauthn.md` §4 에 `auth.service.spec.ts` / `auth.controller.spec.ts` 의 단위 테스트 체크리스트를 추가한다. 최소 포함 케이스: WebAuthn credential 보유 사용자 로그인 분기, `loginWithTotp()` 에 WebAuthn 사용자 백스탑, `LoginChallengeDto` 응답 필드 검증.

- **[CRITICAL]** counter 역행 감지 시 row 삭제 동작에 대한 테스트 공백
  - 위치: `spec/5-system/1-auth.md §1.4.4` (counter 역행 시 즉시 삭제), `review/consistency/2026/05/18/23_11_17/rationale_continuity.md` (Rationale 1.4.E)
  - 상세: counter 역행은 보안 이벤트(인증기 복제·클론 공격)이므로 반드시 테스트로 보호해야 한다. spec은 `verifyAuthenticationResponse` 가 reject 하면 해당 credential row 를 즉시 삭제하고 `LoginHistory` 에 `WEBAUTHN_COUNTER_REGRESSION` 을 기록하도록 정의한다. 이 경로가 단위 테스트로 커버되지 않으면, 구현 중 `WebAuthnCredentialRepository.delete()` 호출 누락 또는 `LoginHistoryService.record()` 미호출이 조용히 통과된다. `@simplewebauthn/server` 의 `verifyAuthenticationResponse` 를 Mock 해 counter 역행 응답을 시뮬레이션하는 테스트가 필요하다.
  - 제안: `WebAuthnService.verifyAuthentication()` 단위 테스트에 다음 두 케이스를 추가한다: (1) counter 역행 시 `deleteCredential()` 호출 여부 spy 확인, (2) `LoginHistoryService.record({ event: 'webauthn_failed', failureReason: 'WEBAUTHN_COUNTER_REGRESSION' })` 호출 여부 확인.

- **[CRITICAL]** 복구 코드 풀 분리(TOTP vs WebAuthn)에 대한 테스트 격리 미계획
  - 위치: `spec/5-system/1-auth.md §1.4.1`, `review/consistency/2026/05/18/23_11_17/rationale_continuity.md` (Rationale 1.4.B)
  - 상세: consistency-check는 `TotpService.disable()` 이 `webauthnRecoveryCodes` 를 건드리지 않음을 단위 테스트로 보호해야 한다고 INFO 로 명시했다. 두 컬럼이 동일 User 엔티티에 있으므로 실수로 한쪽을 지울 수 있다. 또한 WebAuthn credential 전부 삭제 시 `webauthn_recovery_codes` 만 NULL 화 되어야 하고 `totp_recovery_codes` 는 보존되어야 한다. 이 교차 오염 시나리오는 수동으로는 발견하기 어렵고 회귀도 막기 어렵다.
  - 제안: `totp.service.spec.ts` 에 TOTP disable 후 `user.webauthn_recovery_codes` 가 변경되지 않음을 검증하는 테스트를 추가한다. `webauthn.service.spec.ts` 에 마지막 credential 삭제 시 `webauthn_recovery_codes = null`, `totp_recovery_codes = unchanged` 를 검증하는 테스트를 추가한다.

- **[WARNING]** e2e 테스트 전략: Playwright Virtual Authenticator 사용이 plan 에 기술되어 있으나 근거 없이 기본 패턴과 상충
  - 위치: `review/consistency/2026/05/18/23_02_30/rationale_continuity.md` (§ frontend e2e — Playwright Virtual Authenticator)
  - 상세: rationale_continuity 검토는 `PROJECT.md §Frontend e2e 패턴` 이 mock-based 를 기본으로 하는데, plan §5 는 `navigator.credentials` API 특성상 Virtual Authenticator (CDP 세션 기반) 를 사용한다고 명시한다고 INFO 로 지적했다. 이는 타당한 예외지만, plan 에 근거 주석이 없어 구현 시 CDP 세션 설정(`Page.addVirtualAuthenticator`) 방법을 팀이 일관되게 적용할 수 없다. Virtual Authenticator 테스트는 Chrome headless 전용이므로 CI 환경 설정 의존성도 있다.
  - 제안: plan §5 의 e2e 항목에 "(1) `navigator.credentials` API 는 `page.route()` mock 불가 — CDP `Page.addVirtualAuthenticator` 필수. (2) `chromium` 프로젝트 전용 설정 필요. (3) `playwright.config.ts` 에 WebAuthn e2e 전용 project 설정 체크리스트 추가" 형태의 주석을 추가한다.

- **[WARNING]** `WebAuthnService.generateRegistrationOptions` / `generateAuthenticationOptions` 의 optionsToken 발급 로직에 대한 Mock 전략 부재
  - 위치: `spec/5-system/1-auth.md §1.4.4` (optionsToken stateless JWT 설계), `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 5
  - 상세: optionsToken 은 `{ kind, sub, challenge, exp }` 를 담은 5분짜리 stateless JWT 다. 단위 테스트에서 이 JWT 를 생성하고 검증하는 로직을 어떻게 Mock 할지 전략이 없으면 두 가지 함정이 생긴다: (a) 실제 `JwtService.sign()` 을 호출하면 시간 의존성이 생겨 만료 테스트가 불안정해진다. (b) `kind` 값 불일치(`webauthn_register` vs `webauthn_auth`)로 인한 거부 로직을 테스트하려면 특정 payload 를 주입할 수 있어야 한다. naming_collision 검토도 두 JWT 클레임 패턴 혼재(`mfa_challenge: true` vs `kind: string`) 가 구현 혼동을 일으킬 수 있다고 WARNING 으로 지적했다.
  - 제안: 단위 테스트에서 `JwtService` 를 jest mock 으로 교체하고, `kind` 별 서로 다른 payload fixture 를 정의한다. `kind !== 'webauthn_auth'` 를 optionsToken 으로 제출했을 때 401 이 반환됨을 테스트한다.

- **[WARNING]** `LoginChallengeDto` 확장 후 기존 TOTP 클라이언트 호환성 회귀 테스트 미확인
  - 위치: `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 1, `rationale_continuity.md` (WARNING `LoginChallengeDto.requiresTotp` deprecated)
  - 상세: `LoginChallengeDto` 에 `requires2fa`, `methods` 를 추가하고 `requiresTotp` 를 deprecated 로 유지하는 변경은 기존 클라이언트를 위한 backward compat 결정이다. 기존 e2e 테스트가 `/auth/login` 응답에서 `requiresTotp: true` 를 기대하는 assertion 이 있다면, 필드가 유지되더라도 응답 구조 변경으로 인해 깨질 수 있다. 현재 변경 세트에 이 회귀 검증이 포함되어 있지 않다.
  - 제안: 기존 TOTP 로그인 e2e 시나리오를 실행해 `requiresTotp: true` 응답이 그대로 내려오는지 확인한다. `LoginChallengeDto` 변경 PR 에 기존 TOTP e2e 통과 여부를 체크리스트로 추가한다.

- **[WARNING]** `webauthn-credential.entity.ts` TypeORM 등록 누락 가능성 — 통합 테스트에서 repository 주입 실패 위험
  - 위치: `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 7
  - 상세: naming_collision 검토는 `webauthn-credential.entity.ts` 가 `auth.module.ts` 의 `TypeOrmModule.forFeature([...])` 에 누락되면 Repository 주입 실패가 발생한다고 지적했다. 단위 테스트에서는 Repository 를 Mock 하므로 이 누락이 드러나지 않는다. 통합 테스트(실제 DB 연결)나 e2e 에서야 `RepositoryNotFoundError` 로 발견된다. entity 등록 누락은 흔한 실수다.
  - 제안: `auth.module.spec.ts` (모듈 컴파일 테스트) 또는 `WebAuthnService` 통합 테스트에서 `WebAuthnCredentialRepository` 가 주입 가능한지 확인하는 테스트를 추가한다. 또는 `@InjectRepository(WebAuthnCredential)` 이 주입되는 smoke test 를 작성한다.

- **[WARNING]** i18n parity 테스트 — WebAuthn 신규 키 추가 시 ko/en 누락 방지
  - 위치: `plan/in-progress/2fa-webauthn.md` §5 (i18n 키 추가: `profile.security.webauthn.*`, `auth.twoFactor.webauthn.*`, `auth.login.webauthn.*`), `review/consistency/2026/05/18/23_02_30/plan_coherence.md` (harness-i18n 연관)
  - 상세: plan §5 는 신규 i18n 키 군을 추가하면서 ko↔en parity 테스트를 명시한다. plan_coherence 검토는 `harness-i18n-userguide-gap.md` P0 parity 가드가 이미 작동 중이라 자동 검출 가능하다고 했다. 그러나 parity 가드가 "키 개수 일치" 만 체크하는지, "키 이름 일치" 까지 검사하는지에 따라 신규 WebAuthn 키가 한쪽 언어에만 추가된 경우 누락이 발견되지 않을 수 있다.
  - 제안: WebAuthn i18n 키 추가 PR 에서 parity 가드 스크립트의 검사 범위를 확인하고, `profile.security.webauthn.*` 키 군이 ko/en 양쪽에 빠짐없이 존재함을 수동 체크리스트로 PR description 에 명시한다.

- **[INFO]** `forgotPassword` / `checkEmail` 응답 wrapping 누락 — 기존 단위 테스트 회귀 가능성
  - 위치: `review/consistency/2026/05/18/23_11_17/convention_compliance.md` (CRITICAL: forgotPassword·checkEmail wrap 누락)
  - 상세: convention_compliance 검토는 이 두 엔드포인트가 `{ data: ... }` wrap 없이 서비스 반환값을 직접 리턴한다고 CRITICAL 으로 분류했다. 만약 기존 단위·통합 테스트가 `return this.authService.forgotPassword(...)` 패턴을 전제로 `{ message: '...' }` 형태의 응답을 직접 assert 한다면, 올바른 수정(`return { data: { message } }`) 후 기존 테스트가 깨진다. 이는 테스트가 의도된 계약이 아닌 버그를 검증하고 있는 상황이다.
  - 제안: `auth.controller.spec.ts` 에서 `forgotPassword` / `checkEmail` 응답 shape 을 `{ data: { message } }` 로 assert 하도록 수정한다. 수정 전·후 테스트를 함께 검토해 실제 버그가 테스트에 박제되어 있지 않은지 확인한다.

- **[INFO]** `SessionListDto.data` 이중 중첩 — 기존 세션 e2e 테스트가 잘못된 schema 를 기준으로 작성됐을 가능성
  - 위치: `review/consistency/2026/05/18/23_11_17/convention_compliance.md` (WARNING: SessionListDto·LoginHistoryPageDto 이중 중첩)
  - 상세: convention_compliance 검토는 `SessionListDto` 가 `data: SessionDto[]` 를 내포해 `@ApiOkWrappedResponse` 와 결합 시 `{ data: { data: [...] } }` 이중 중첩이 발생한다고 지적했다. 기존 세션 목록 e2e 테스트가 `response.data.data` 를 순회하는 코드로 작성되어 있다면, 이중 중첩을 수정한 후 테스트도 `response.data` 로 변경해야 한다. 반대 방향으로도 가능하다 — 현재 테스트가 `response.data` 를 기대한다면 실제 응답이 이중 중첩이라는 버그가 테스트에서 가려져 있을 수 있다.
  - 제안: 세션 목록 API 의 e2e·통합 테스트에서 응답 구조 assertion 을 확인하고, 구현 수정과 테스트 수정을 동일 PR 에 포함시킨다.

- **[INFO]** 마이그레이션 번호(V057·V058) 점유 확인 절차가 자동화되지 않음
  - 위치: `review/consistency/2026/05/18/23_11_17/naming_collision.md` 발견사항 6, `plan_coherence.md` (WARNING: V057·V058 선점 충돌)
  - 상세: plan §3 는 "착수 직전 `ls migrations | sort -V | tail -1`" 로 번호를 재확인하도록 명시한다. 이는 수동 절차이므로 구현자가 생략할 수 있다. 마이그레이션 번호 충돌은 CI 에서만 발견되는 경우가 많다.
  - 제안: CI 파이프라인에 마이그레이션 파일명 중복 검사 스텝을 추가하거나, 기존 guard 스크립트(`python3` 가드)가 번호 충돌을 검출하는지 확인한다. 없으면 `ls migrations/ | sort -V | uniq -d` 를 CI pre-check 로 추가한다.

- **[INFO]** WebAuthn credential AuditLog 포함 여부 미결 — 테스트 케이스 정의 불가능한 상태
  - 위치: `review/consistency/2026/05/18/23_11_17/cross_spec.md` (WARNING: §4.1 AuditLog 목록에 WebAuthn 등록·삭제 누락)
  - 상세: cross_spec 검토는 `webauthn_credential_register` / `webauthn_credential_delete` 가 AuditLog 대상인지 미결이라고 지적했다. 이 결정이 확정되지 않으면 `WebAuthnService.deleteCredential()` 또는 `register/verify` 핸들러 구현 시 AuditLog 기록 코드를 작성해야 하는지 불명확하고, 단위 테스트에서 AuditLogService 호출 여부 spy 도 추가할 수 없다.
  - 제안: spec 결정 전에 구현 착수 시, AuditLog 포함 여부를 구현 주석으로 `// TODO: spec 미결 — AuditLog 포함 결정 후 추가` 로 명시하고, 해당 결정이 확정된 PR 에서 테스트와 함께 추가한다.

---

### 요약

이 변경 세트는 실제 구현 코드가 아닌 spec 문서 갱신과 consistency-check 결과 파일들로 구성되어 있다. 테스트 관점에서 가장 심각한 문제는 WebAuthn 핵심 보안 로직(로그인 분기에서 WebAuthn 우선 탐지, `loginWithTotp()` 백스탑, counter 역행 시 row 삭제)이 구현 plan 에 단위 테스트 항목으로 계획되지 않은 점이다. consistency-check 가 CRITICAL 로 분류한 `auth.service.ts` 의 WebAuthn credential 미확인과 `LoginHistoryEvent` 타입 유니온 불일치는 각각 단위 테스트를 작성하지 않으면 구현 후에도 회귀될 가능성이 높다. 복구 코드 풀 분리(TOTP / WebAuthn) 는 교차 오염 버그를 막는 핵심 테스트지만 plan 에 명시되어 있지 않다. 기존 코드의 `forgotPassword` / `checkEmail` wrap 누락과 `SessionListDto` 이중 중첩은 기존 테스트가 버그를 기준으로 작성됐을 가능성이 있어 수정 시 회귀 위험을 동반한다. 전반적으로 spec 설계 품질은 높지만, 그 설계의 보안 특성을 테스트로 보장하는 계획이 구현 phase 에 명시적으로 포함되어야 한다.

---

### 위험도

HIGH
