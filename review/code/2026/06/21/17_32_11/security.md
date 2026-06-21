# 보안(Security) 리뷰 결과

리뷰 대상: M-2 IntegrationOAuthService provider 별 OAuthProviderStrategy 분리
커밋: 2a64b7d377b8d5a80c193fcdd62da72704e3020c

---

## 발견사항

### [INFO] JWT 서명 검증 없이 exp 클레임 신뢰
- 위치: `/codebase/backend/src/modules/integrations/jwt-exp.ts` (parseJwtExp 함수 전체)
- 상세: `parseJwtExp`는 Cafe24/MakeShop 액세스 토큰의 JWT payload를 서명 검증 없이 base64url 디코드하여 `exp` 클레임을 읽는다. 코드 주석은 "토큰 진위는 Cafe24 API가 호출 시점에 자체 검증하므로 보안 침해 경로 없음"이라고 설명하며, 이 함수의 목적이 만료 시각 메타데이터 추출(TTL 계산)에 국한됨을 명시한다. 검증 없이 읽힌 `exp` 값은 DB에 `tokenExpiresAt`으로 저장되는데, 공격자가 서버가 아니라 토큰 갱신 또는 스캐너 경로를 직접 제어하지 않는 한 이 경로가 악용될 수 없다. Cafe24의 JWT 공개키가 공개되어 있지 않다는 사실도 주석에 명시되어 있다. 실용적으로 위협 모델에 부합하는 설계이나, 향후 Cafe24가 공개키를 제공하거나 MakeShop JWT 검증이 필요해질 경우를 대비해 검증 미수행임을 문서에 명시해 두는 것이 좋다.
- 제안: 현 설계는 허용 가능하다. 다만 `parseJwtExp` JSDoc에 "만료 TTL 추출 전용 — 위조 방어는 downstream API 호출이 담당" 문구를 유지하고, MakeShop 공개키가 향후 공개될 경우 검증 추가를 고려한다.

---

### [INFO] Cafe24 private app credentials가 OAuth state provider_meta에 암호화된 채 전달되는 설계 검토
- 위치: `/codebase/backend/src/modules/integrations/oauth-providers/cafe24-private.strategy.ts` (resolveCredentials, 전체 파일)
- 상세: Cafe24 private app의 `client_id`/`client_secret`이 OAuth state 행의 `provider_meta` JSONB 칼럼에 저장되고, 토큰 교환 시 `TokenRequestInput.providerMeta`로 전달된다. 코드 주석은 "encrypted on the integration row + the OAuth state"라고 설명하나, 이 리뷰 범위의 변경사항에서 암호화 적용 여부를 직접 확인할 수 없다. 이 리팩터링 자체는 기존 동작을 전달만 하므로 신규 취약점은 아니지만, provider_meta가 실제로 DB 저장 전 암호화되는지, 또는 OAuth state TTL(10분) 동안 평문으로 저장되는지 기존 구현에서 확인이 필요하다. 평문 저장이라면 DB 직접 접근 공격자에게 client_secret이 노출된다.
- 제안: 기존 facade(IntegrationOAuthService)에서 state 행 저장 시 provider_meta를 암호화하고 있는지 확인한다. 암호화되어 있다면 현 설계는 안전하다. 이 리뷰 범위의 변경은 기존 동작을 유지하므로 이 점에서 신규 위험을 도입하지 않는다.

---

### [INFO] MakeShop buildTokenRequest: code_verifier 없을 경우 PKCE 없이 진행 가능
- 위치: `/codebase/backend/src/modules/integrations/oauth-providers/makeshop.strategy.ts` 77번째 줄
- 상세: `if (pm.code_verifier) params.code_verifier = pm.code_verifier;` — code_verifier가 없으면 조용히 생략되어 PKCE 없는 token exchange가 이루어진다. MakeShop이 OAuth 2.1을 따른다면 code_verifier는 필수이며, 서버가 이를 강제 검증한다. 그러나 code_verifier 누락 시 `BadRequestException`을 던지지 않고 조용히 진행하므로, 만약 MakeShop 서버 측 PKCE 검증이 선택적으로 구현되어 있다면 authorization code interception 위험이 잔존한다. buildAuthorizeUrl에서는 `code_challenge` 누락 시 에러를 던지는데(`MAKESHOP_PKCE_REQUIRED`), buildTokenRequest에서는 대칭적 검증이 없다.
- 제안: `buildTokenRequest`에서도 `pm.code_verifier`가 없으면 `BadRequestException({ code: 'MAKESHOP_PKCE_REQUIRED', message: 'PKCE code_verifier is required for MakeShop token exchange' })`를 던지도록 강화한다. 이는 MakeShop이 OAuth 2.1 필수 PKCE를 실제로 강제하지 않는 경우에도 서버 측 방어 심화를 제공한다.

---

### [INFO] mallId 입력의 정규식 검증이 buildAuthorizeUrl에서는 없고 facade에만 존재
- 위치: `/codebase/backend/src/modules/integrations/oauth-providers/cafe24-oauth.strategy.ts` buildAuthorizeUrl (790-808번째 줄)
- 상세: Cafe24 authorize URL 빌드 시 `mallId`가 null/undefined인지만 확인하고 `CAFE24_MALL_ID_PATTERN(/^[a-z0-9-]{3,50}$/)` 형식 검증은 수행하지 않는다. facade의 begin 경로에서는 pattern 검증 후 mallId를 전달하므로 정상 경로에서는 문제가 없다. 그러나 strategy의 `buildAuthorizeUrl`을 facade 외부에서 직접 호출하거나 향후 진입점이 추가될 경우, 임의 mallId가 `https://${mallId}.cafe24api.com/...` URL에 삽입되어 SSRF 또는 open redirect로 이어질 수 있다.
- 제안: `Cafe24OAuthStrategyBase.buildAuthorizeUrl` 내부에서도 `CAFE24_MALL_ID_PATTERN`으로 mallId를 검증한다. 패턴 상수를 strategy 파일로 이동하거나 공유 유틸로 추출하면 된다. 이중 검증이 되더라도 defense-in-depth 관점에서 전략 레이어가 자체 입력 검증을 갖추는 것이 바람직하다.

---

### [INFO] 진단 로그에 내부 식별자 (mall_id, 스코프 목록) 노출
- 위치: `/codebase/backend/src/modules/integrations/oauth-providers/cafe24-oauth.strategy.ts` describeExchange (896-925번째 줄)
- 상세: `describeExchange`가 반환하는 경고/정보 메시지에 `mall_id`, `requestedScopes.join(',')`, `result.scopes.join(',')` 등 내부 식별자와 권한 정보가 포함된다. facade에서 `this.logger.warn(warning)` / `this.logger.log(line)`으로 출력된다. 이 값들이 구조화 로깅 시스템에서 외부에 노출되거나 로그 집계 시스템에서 민감 데이터로 분류되는지 확인이 필요하다. 단, 스코프 목록과 mall_id는 보통 반공개 정보이므로 CRITICAL 수준은 아니다.
- 제안: 로그 레벨이 production에서 `warn`/`log` 양쪽 모두 외부로 유출되지 않도록 로깅 파이프라인 설정을 확인한다. 민감 데이터(client_id, client_secret 등)는 로그에 절대 포함되지 않으며, 이 변경에서도 그 규칙은 잘 준수되고 있다.

---

## 요약

이번 변경은 IntegrationOAuthService 내 다중 OAuth 프로토콜 혼합 코드를 provider별 strategy로 분리한 순수 리팩터링이다. 새로운 보안 취약점을 도입하지 않으며, 기존 보안 메커니즘(HMAC/nonce 기반 install 보안, state TTL, CAFE24_MALL_ID_PATTERN 검증, sanitizeLastErrorMessage, Basic Auth 헤더 분리)은 facade에 그대로 잔류한다. MakeShop buildTokenRequest에서 code_verifier 누락 시 에러를 던지지 않는 비대칭 처리와, Cafe24 strategy의 buildAuthorizeUrl에서 mallId 형식 검증이 없는 점이 방어 심화 측면에서 개선 권장 사항이나, 정상 경로(facade를 통한 진입)에서는 facade 레이어가 이미 검증을 수행하고 있어 실질 위협 노출은 없다. JWT 서명 미검증은 설계 의도이며 충분한 근거가 문서화되어 있다.

---

## 위험도

LOW
