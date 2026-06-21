# 보안(Security) 리뷰 결과

## 발견사항

### 인젝션 취약점

- **[INFO]** `cafe24AuthorizeUrl` / `cafe24TokenUrl` 함수가 외부 입력인 `mallId` 를 URL 에 직접 보간한다.
  - 위치: `/codebase/backend/src/modules/integrations/oauth-providers/cafe24-oauth.strategy.ts` L21, L25
  - 상세: `https://${mallId}.cafe24api.com/...` 패턴에서 `mallId` 가 임의 문자열이면 호스트명 인젝션(SSRF 계열)이 가능하다. 이 commit diff 자체는 주석 추가뿐이라 신규 취약점 도입은 아니다. 단, RESOLUTION.md 에서 "facade 가 `CAFE24_MALL_ID_PATTERN` 으로 선검증" 한다고 명시하므로 정상 흐름에서는 검증이 이루어진다. 그러나 strategy 레이어 자체에는 패턴 검증이 없어 strategy 를 직접 호출하는 경로(예: 테스트, 미래 다른 호출자)에서는 방어선 없음.
  - 제안: 이 이슈는 이전 리뷰(Security INFO 4)에서 이미 식별되어 "후속 hardening 후보"로 미뤄진 상태다. 현 changeset 에서 신규 도입은 아니므로 INFO 수준 유지.

### 하드코딩된 시크릿

- **[INFO]** 테스트 파일에 자격증명 형태의 문자열 리터럴이 존재한다.
  - 위치: `oauth-provider-strategy.spec.ts` L143-144
  - 상세: `envCreds = { clientId: 'env-id', clientSecret: 'env-secret' }`, `providerMeta` 내 `client_id: 'priv-id'`, `client_secret: 'priv-secret'` 등이 테스트 픽스처로 하드코딩되어 있다. 테스트 전용 가짜 값이며 실제 비밀 정보가 아니다. 비밀 관리 정책 위반 없음.

### 인증/인가

- **[INFO]** `parseJwtExp` 가 서명 검증 없이 JWT payload 를 디코드한다.
  - 위치: `/codebase/backend/src/modules/integrations/jwt-exp.ts` L27-50
  - 상세: 이 동작은 설계 의도로 문서화되어 있으며(주석 및 spec 참조), 위조 토큰은 Cafe24 API 호출 시점에 401 로 거부된다. 만료 시각 추출 전용 helper 이므로 서명 미검증이 인가 우회 경로가 되지 않는다. 이전 리뷰 Security INFO 1 에서 이미 식별 및 수용됨.

- **[INFO]** `Cafe24PrivateOAuthStrategy.resolveCredentials` 가 `providerMeta` (OAuth state 에서 복호화된 값) 로부터 client credentials 를 읽는다.
  - 위치: `/codebase/backend/src/modules/integrations/oauth-providers/cafe24-private.strategy.ts` L22-30
  - 상세: private app 의 `client_id` / `client_secret` 이 OAuth state `provider_meta` 에 단기 보관되고, 이 changeset 에서는 해당 흐름을 바꾸지 않는다. state 의 암호화·무결성 보호는 facade 레이어에 있다(이 파일 범위 밖). 이전 리뷰 Security INFO 2 에서 수용됨.

### 입력 검증

- **[INFO]** `makeshop.strategy.ts` 의 `buildTokenRequest` 에서 `code_verifier` 부재 시 silent skip 이 발생한다.
  - 위치: `/codebase/backend/src/modules/integrations/oauth-providers/makeshop.strategy.ts` L77
  - 상세: `if (pm.code_verifier) params.code_verifier = ...` 패턴이므로 `code_verifier` 가 없으면 토큰 요청에서 조용히 생략된다. OAuth 2.1 PKCE 를 강제하는 provider 의 경우 서버 측에서 거부하겠지만, silent fail 이라 디버깅이 어렵다. RESOLUTION.md 에서 "behavior parity 위해 미적용" 으로 의도적으로 유지됨. 신규 도입 아님.

### OWASP Top 10

이 changeset 에서 OWASP Top 10 해당 신규 취약점은 발견되지 않았다.

### 암호화

- **[INFO]** Basic Auth 헤더를 위해 `Buffer.from(...).toString('base64')` 를 사용한다.
  - 위치: `cafe24-oauth.strategy.ts` L92, `makeshop.strategy.ts` L83
  - 상세: Basic Auth 는 Base64 인코딩이 표준이다. credentials 전송 보안은 HTTPS 계층이 담당하며, strategy 가 생성하는 것은 HTTP 요청 스펙뿐으로 실제 HTTPS 강제는 고정된 `https://` URL 에 의존한다. 신규 도입 아님.

### 에러 처리

- **[INFO]** `BadRequestException` / `InternalServerErrorException` 의 `code` 필드에 구조화된 에러 코드를 담아 throw 한다.
  - 위치: 각 strategy 파일 전반
  - 상세: 에러 응답에 `client_id`, `client_secret` 등 자격증명 값이 포함되지 않는다. `OAUTH_CONFIG_MISSING` 메시지에는 환경변수 키 이름(`GOOGLE_CLIENT_ID` 등)만 노출되며, 실제 값은 포함되지 않는다. 허용 가능.

### 의존성 보안

이 changeset 은 신규 npm 의존성을 추가하지 않는다. 기존 `@nestjs/common` 을 통한 예외 클래스 사용만 있으며, 알려진 취약점 도입 없음.

### 테스트 파일 보안

- **[INFO]** `makeFakeJwt` 헬퍼가 `sig-not-verified` 고정 문자열을 서명 segment 로 사용한다.
  - 위치: `__test-utils__/make-fake-jwt.ts` L21-23, `oauth-provider-strategy.spec.ts` L124
  - 상세: 테스트 전용 파일이며 프로덕션 번들에 포함되지 않는다. 서명 미검증을 명시적으로 표기하는 패턴이므로 적절.

---

## 요약

이번 changeset 의 실질적 코드 변경은 `integration-oauth.service.ts` 의 주석 1행 추가와 `oauth-provider-strategy.spec.ts` 테스트 파일 신설뿐이다. 테스트 파일은 프로덕션 실행 경로에 포함되지 않으며, 픽스처 자격증명은 모두 가짜 값이다. 주석 추가는 보안 표면을 변경하지 않는다. 이전 리뷰에서 식별된 보안 관찰 사항(JWT 서명 미검증, mallId 패턴검증 strategy 부재, code_verifier silent skip)은 모두 이전 SUMMARY/RESOLUTION 에서 수용·문서화된 것으로, 이번 diff 가 이 상황을 신규 도입하거나 악화시키지 않는다.

---

## 위험도

LOW
