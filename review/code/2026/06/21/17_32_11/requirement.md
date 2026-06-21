# 요구사항(Requirement) Review

리뷰 대상 커밋: `2a64b7d377b8d5a80c193fcdd62da72704e3020c`
M-2 IntegrationOAuthService provider 별 OAuthProviderStrategy 분리

---

## 발견사항

### [INFO] 기능 완전성 — M-2 구현 범위 전면 충족

- 위치: 전체 변경
- 상세: plan `02-architecture.md §M-2` 에 명시된 Option A 범위(begin authorize URL / exchangeCodeForToken cred·URL·form / normalizeTokenResponse meta / parseTokenExpiresAt / stub / cafe24 진단을 strategy 위임)가 모두 구현됐다. 인터페이스(`OAuthProviderStrategy`), 공유 베이스(`StandardOAuthStrategy`, `Cafe24OAuthStrategyBase`), 개별 전략 5개(google·github·cafe24-public·cafe24-private·makeshop), registry(`resolveOAuthStrategy`)가 신설됐고, facade 잔류 명시 항목(install 보안·state/preview lifecycle·status_reason 매핑·외부 API 호출)은 facade에 그대로 남아 있다.
- 제안: 없음.

### [INFO] 관련 spec 본문 일치 — 내부 구조 분리는 spec 명시 구현 재량

- 위치: `spec/2-navigation/4-integration.md` 전체 + Rationale 참조
- 상세: spec `4-integration.md` 는 `IntegrationOauthService` 를 data-flow 다이어그램의 단일 participant 로 유지하며, "provider 별 분리인지 파라메트릭인지는 구현 세부 사항" 으로 명시한다 (line 1311). M-2 는 facade 명·외부 API 계약·상태 전이를 일절 변경하지 않으므로 spec 과 구현 간 충돌 없다.
- 제안: 없음.

### [INFO] Cafe24 토큰 만료 precedence — spec line 594·931과 완전 일치

- 위치: `cafe24-oauth.strategy.ts` `parseTokenExpiresAt`
- 상세: spec §3.2·§10.5·Rationale "Cafe24 token 만료 SoT — JWT exp 격상" 에 명시된 순서(JWT `exp` → `expires_in` → `expires_at` ISO KST 정규화 → 2h default)가 `Cafe24OAuthStrategyBase.parseTokenExpiresAt` 에 line-level 로 동일하게 구현됐다. `normalizeCafe24IsoTimezone` 호출도 정상 유지.
- 제안: 없음.

### [INFO] MakeShop OAuth 2.1 PKCE + Basic auth — spec line 661과 일치

- 위치: `makeshop.strategy.ts` `buildAuthorizeUrl` · `buildTokenRequest`
- 상세: spec §5.9 "Authorization-Code + PKCE(OAuth 2.1)… authorize: `https://auth.makeshop.com/oauth/authorize` (PKCE S256)… 토큰 교환: `POST https://auth.makeshop.com/oauth/token` (Basic auth `client_id:client_secret`)" 이 코드와 일치한다. `codeChallenge` 미제공 시 `MAKESHOP_PKCE_REQUIRED` 예외, `code_verifier` 누락 시 body 제외(optional 처리)도 정상.
- 제안: 없음.

### [INFO] Cafe24 comma scope delimiter — spec §3.2와 일치

- 위치: `cafe24-oauth.strategy.ts` `buildAuthorizeUrl` line 805
- 상세: spec §3.2 "Cafe24 `/oauth/authorize`… scope 는 comma 구분" 이 `input.scopes.join(',')` 로 구현됐다. google/github 는 RFC 6749 표준 공백 구분(`join(' ')`)으로 분기된다.
- 제안: 없음.

### [WARNING] `providerEnvCredentials(provider='cafe24')` 가 cafe24 public buildTokenRequest 에 전달됨 — private 와 불분리

- 위치: `integration-oauth.service.ts` line 1085 + `cafe24-public.strategy.ts` `resolveCredentials`
- 상세: `exchangeCodeForToken` 에서 `this.providerEnvCredentials(provider)` 는 provider='cafe24' 인 경우 `env.cafe24`(공개 app env creds)를 반환한다. private 분기에서 strategy 가 `cafe24PrivateOAuthStrategy` 로 resolve 되면 `resolveCredentials` 는 `envCredentials` 를 무시하고 `providerMeta` 의 `client_id`/`client_secret` 을 사용한다. public 분기 역시 `cafe24PublicOAuthStrategy.resolveCredentials` 가 `envCredentials` 만 사용한다. 기능적으로 문제없으나 private 인 경우에도 `env.cafe24` creds 가 `envCredentials` 로 전달된다는 점이 약간 redundant 하다. 버그는 아니며 private strategy 가 이 값을 무시하므로 동작은 올바르다.
- 제안: 현재 동작은 정확하다. 단 의도 명확화를 위해 주석 "private strategy ignores envCredentials" 를 `exchangeCodeForToken` 호출부에 추가하면 가독성이 높아진다. 수정 우선도 낮음.

### [INFO] `resolveOAuthStrategy(service.oauthProvider, 'public')` — begin 시 appType 하드코딩

- 위치: `integration-oauth.service.ts` line 539
- 상세: `begin` 흐름의 이 분기에 도달하는 것은 cafe24-public / google / github 뿐이며(cafe24-private 와 makeshop 은 위에서 early-return), 'public' appType 전달은 의미상 정확하다. google/github 는 appType 을 무시하므로 부작용 없다.
- 제안: 없음.

### [INFO] `GitHubOAuthStrategy.extractProviderMeta` — `login` 필드 null 가능

- 위치: `github.strategy.ts` line 1153
- 상세: `{ login: readString(data, 'login') }` 에서 `readString` 이 null 을 반환할 수 있어 `providerMeta.login = null` 이 저장된다. 기존 inline 코드도 `readString(data, 'login')` 이 null 이면 그냥 undefined로 두던 패턴이었는데 이제는 명시적으로 null 이 담긴다. 저장되는 JSONB 에 `"login": null` 이 기록된다. 단 하위 호환성 이슈는 없고 spec 에 특정 동작이 명시되지 않으므로 INFO.
- 제안: `login: readString(data, 'login') ?? undefined` 로 변경하거나, null 저장도 허용하는 경우 현행 유지. 기능 버그 아님.

### [INFO] `GoogleOAuthStrategy.extractProviderMeta` — `account_email` null 가능

- 위치: `google.strategy.ts` line 1230
- 상세: `account_email: readString(data, 'account_email') ?? readString(data, 'email')` 에서 두 필드 모두 없으면 null 이 담긴다. 기존 동작과 동일 (기존 코드도 `readString(data, ...) ?? readString(data, ...)` 패턴). 동작 변경 없음.
- 제안: 없음.

### [INFO] `MakeshopOAuthStrategy.describeExchange` 미구현 — spec 상 명시 없음

- 위치: `makeshop.strategy.ts` (메서드 없음)
- 상세: `OAuthProviderStrategy` 인터페이스에서 `describeExchange` 는 optional(`?`)로 선언됐다. makeshop 은 cafe24 와 달리 mall_id mismatch 나 scope silent-grant 차이를 진단할 명시적 spec 요구사항이 없다. facade 의 `strategy.describeExchange?.()` 호출은 null 체크로 안전 처리됐다.
- 제안: 없음.

### [INFO] `readString` re-export — facade에서 `import { readString }` 유지

- 위치: `integration-oauth.service.ts` line 81 + `normalizeTokenResponse` 내부 line 2595
- 상세: `normalizeTokenResponse` 함수 내부에서 `readString` 을 여전히 직접 사용한다 (`const refreshToken = readString(data, 'refresh_token') ?? null`). 이 `readString` 은 `./oauth-providers` 에서 import 된 것이다. 기능적으로 정확하며 단순 사용 패턴.
- 제안: 없음.

---

## 요약

M-2 리팩터링은 의도한 기능(provider 별 OAuth 프로토콜 로직을 strategy 로 분리, facade 외부 계약 유지)을 완전히 구현했다. spec `4-integration.md` 가 명시한 토큰 만료 precedence(cafe24: JWT exp → expires_in → expires_at KST 정규화 → 2h default), Basic auth 방식(cafe24/makeshop), PKCE S256(makeshop), comma scope(cafe24) vs 공백 scope(google/github), 에러 코드(CAFE24_INVALID_MALL_ID, CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED, MAKESHOP_CREDENTIALS_REQUIRED, OAUTH_CONFIG_MISSING 등)가 모두 line-level 로 보존됐다. spec 은 provider 별 분리 여부를 구현 재량으로 명시하므로 strategy 패턴 도입은 SPEC-DRIFT 사안이 아니다. 실질적 기능 버그 없음. WARNING 1건은 private strategy 에서 env creds 전달이 redundant 하다는 설계 미세 이슈이며 동작은 정확하다.

## 위험도

LOW
