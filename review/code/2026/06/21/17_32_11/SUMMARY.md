# Code Review 통합 보고서

리뷰 대상: M-2 IntegrationOAuthService provider 별 OAuthProviderStrategy 분리
커밋: 2a64b7d377b8d5a80c193fcdd62da72704e3020c

---

## 전체 위험도

**MEDIUM** — 신설 strategy 클래스 7개에 전용 단위 테스트가 전혀 없고, 핵심 예외 분기(PKCE guard, credential guard, mall_id mismatch 진단)가 facade 경유 통합 테스트에만 간접 의존한다. 보안·아키텍처·요구사항·API 계약은 모두 LOW 이하이며, 기능 정확성 버그는 발견되지 않았다.

---

## Critical 발견사항

(없음)

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | 신설 strategy 파일 7개(`oauth-providers/` 전체)에 전용 단위 테스트 없음 | `oauth-providers/` 전체 | `oauth-providers/*.spec.ts` 추가 |
| 2 | Testing | `Cafe24OAuthStrategyBase.buildAuthorizeUrl` — `mallId` 누락 시 `CAFE24_INVALID_MALL_ID` 예외 경로 직접 테스트 없음 | `cafe24-oauth.strategy.ts` | 단위 테스트 추가 |
| 3 | Testing | `MakeshopOAuthStrategy.buildAuthorizeUrl` — `codeChallenge` 누락 시 `MAKESHOP_PKCE_REQUIRED` 예외 경로 테스트 없음 | `makeshop.strategy.ts` | 단위 테스트 추가 |
| 4 | Testing | `Cafe24PrivateOAuthStrategy.resolveCredentials` — 자격증명 누락 시 `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` 예외 경로 단위 테스트 없음 | `cafe24-private.strategy.ts` | 단위 테스트 추가 |
| 5 | Testing | `Cafe24OAuthStrategyBase.describeExchange` — mall_id 불일치·scope 부족 진단 분기 직접 테스트 없음 | `cafe24-oauth.strategy.ts` | (a) echoMallId 불일치 (b) scope 부족 (c) 정상 info 세 분기 테스트 |
| 6 | Testing | `parseTokenExpiresAt` shim 위임 — makeshop 4분기 단위 커버리지 불분명 | `makeshop.strategy.ts` | 분기별 단위 테스트 추가 |
| 7 | Requirement | `providerEnvCredentials('cafe24')` 가 private 분기에서도 `envCredentials` 로 전달되나 private strategy 가 무시 — 동작 정확하나 의도 불명확 | `integration-oauth.service.ts` exchangeCodeForToken | 주석 `// private strategy ignores envCredentials` 추가 (우선도 낮음) |

---

## 참고 (INFO) — 21건 요약

- **Security (5)**: parseJwtExp 서명 미검증(설계 의도·문서화됨), cafe24 private creds provider_meta 저장(기존 동작 유지), makeshop buildTokenRequest code_verifier 누락 시 silent 생략(원본 동작 유지 — 대칭 throw 는 behavior change 라 미적용), cafe24 buildAuthorizeUrl mallId 패턴검증 strategy 부재(facade 검증 선행, defense-in-depth 권고), describeExchange 로그 식별자(client secret 미포함).
- **Architecture (4)**: strategy 가 NestJS 예외 직접 throw(프레임워크 결합), AuthorizeUrlInput/TokenRequestInput superset 필드(ISP 약화), resolveOAuthStrategy appType 비-cafe24 무의미, buildStubResult 프로덕션 인터페이스 포함 — 모두 현 규모 허용.
- **Scope (2)**: cafe24AuthorizeUrl/cafe24TokenUrl 동일 파일 내부 전용인데 export(정리 권고), review/consistency 동일 커밋 포함(규약 허용·비차단).
- **Side Effect (2)**: strategy singleton stateless 확인됨(후속 인스턴스 변수 쓰기 주의), TokenExchangeResult facade re-export 누락(외부 import 없어 무해).
- **Maintainability (2)**: normalizeTokenResponse 내 resolveOAuthStrategy 이중 호출(O(1)), buildStubResult stub 토큰 패턴 중복.
- **Testing (2)**: StandardOAuthStrategy stub provider prefix 검증, resolveOAuthStrategy registry smoke test.
- **Requirement (1)**: GitHub extractProviderMeta `login: null` 명시 저장(기존 패턴과 미세차, 무해).
- **Documentation (2)**: parseTokenExpiresAt shim JSDoc 구체 파일 경로 부재, resolveOAuthStrategy JSDoc 블록 부재.

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 |
|----------|--------|
| security | LOW |
| architecture | LOW |
| requirement | LOW |
| scope | NONE |
| side_effect | LOW |
| maintainability | LOW |
| testing | MEDIUM |
| documentation | LOW |
| api_contract | NONE |

router skip: performance, dependency, database, concurrency, user_guide_sync (변경 성격상 무관).

---

## 결정

Critical 0. WARNING 7 (testing 6 + requirement 1). 표준 REVIEW WORKFLOW 의무에 따라 resolution 적용: 전략 전용 단위 테스트 신설(WARNING 1-6 + testing INFO 17/18) + envCredentials 주석(WARNING 7). 상세 RESOLUTION.md 참조.

> ⚠️ summary_written=false (workflow terminal write 차단) — 본 파일은 main 이 `summary_markdown` 으로 멱등 persist.
