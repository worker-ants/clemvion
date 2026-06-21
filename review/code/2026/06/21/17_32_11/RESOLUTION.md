# Resolution — M-2 IntegrationOAuthService strategy 분리 ai-review

원 리뷰: `SUMMARY.md` (커밋 `2a64b7d3`). Critical 0, WARNING 7, INFO 21, 전체 MEDIUM(testing 주도).
적용자: main(직접 Edit — bg worktree subagent Edit/Write block 회피).

## WARNING 처리 (7건)

| # | 카테고리 | 조치 | 결과 |
|---|----------|------|------|
| 1 | Testing — strategy 전용 단위 테스트 부재 | **FIX** `oauth-providers/oauth-provider-strategy.spec.ts` 신설 (31 케이스) | resolveOAuthStrategy registry 매핑 + 5개 전략 전 메서드 직접 단위 검증 |
| 2 | Testing — cafe24 buildAuthorizeUrl mallId 누락 예외 | **FIX** | `CAFE24_INVALID_MALL_ID` 예외 경로 직접 테스트 추가 |
| 3 | Testing — makeshop buildAuthorizeUrl codeChallenge 누락 예외 | **FIX** | `MAKESHOP_PKCE_REQUIRED` 예외 경로 직접 테스트 추가 |
| 4 | Testing — cafe24-private resolveCredentials 자격증명 누락 예외 | **FIX** | `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` (buildTokenRequest 경유) 테스트 추가 |
| 5 | Testing — cafe24 describeExchange 진단 분기 | **FIX** | (a) mall_id 불일치 경고 (b) scope 부족 경고 (c) 정상 info, + 일치 시 무경고 케이스 테스트 추가 |
| 6 | Testing — makeshop parseTokenExpiresAt 4분기 | **FIX** | expires_in→expires_at→JWT exp→1h fallback 분기별 테스트 추가 (cafe24 JWT exp 우선·KST 정규화·2h default 도 추가) |
| 7 | Requirement — private 분기 envCredentials redundant (동작 정확) | **FIX(주석)** | `exchangeCodeForToken` buildTokenRequest 호출부에 "cafe24-private·makeshop ignore envCredentials, use providerMeta creds" 주석 추가 |

## INFO 처리 (선별)

- **Security INFO 3 (makeshop buildTokenRequest code_verifier 누락 시 silent 생략 — 대칭 throw 권고)**: **미적용 (의도)**. 원본 `exchangeCodeForToken` 도 `if (makeshopCodeVerifier) params.code_verifier = ...` 로 optional 처리했다. 대칭 throw 추가는 **behavior change** 이며 M-2 는 순수 refactor(behavior parity) 원칙이라 미적용. code_verifier 누락 시 silent 생략 동작을 보존.
- **Security INFO 4 (cafe24 buildAuthorizeUrl mallId 패턴검증 strategy 부재 — defense-in-depth)**: **미적용 (의도)**. facade `begin` 이 `CAFE24_MALL_ID_PATTERN` 으로 mall_id 를 선검증하고, install 경로의 mall_id 는 저장된 creds.mall_id 와 매칭 검증 후에만 strategy 에 도달한다(정상 경로 검증 선행). strategy 레이어 중복 검증은 새 동작 도입이라 refactor 범위 밖으로 보류 — 후속 hardening 후보.
- **Side Effect INFO 14 / TokenExchangeResult re-export 누락**: **확인 — 무해**. `grep -r TokenExchangeResult codebase/backend/src` 결과 외부 import 없음(facade 내부 + strategy 모듈 전용). 기존에도 module-internal interface 였으므로 re-export 불요.
- **Scope INFO 11 (cafe24AuthorizeUrl/cafe24TokenUrl export)**: **현행 유지**. cafe24 URL 의 canonical 빌더로서 향후 재사용 여지가 있어 export 보존(동작·위험 무관). 비차단 INFO.
- **Maintainability INFO 15 (normalizeTokenResponse 내 resolveOAuthStrategy 이중 호출)**: **현행 유지**. O(1) switch 위임이라 성능 무영향. normalizeTokenResponse 의 strategy 자가 해석은 exported `parseTokenExpiresAt` shim 과 동일 패턴으로 자기완결성 유지가 더 명확.
- 나머지 INFO(아키텍처 framework 결합·ISP·stub 인터페이스 분리, 문서 JSDoc 보강 등)는 현 5-provider 규모에서 허용 가능한 설계 트레이드오프로 reviewer 가 명시 — 비차단, 후속 고려.

## 검증

- lint: PASS (신규 spec + facade clean)
- unit: integrations 모듈 14 suites / **477 tests PASS** (기존 446 + 신규 전략 31)
- 신규 동작 변경 없음 — facade 변경은 주석 1건뿐(`git diff` 로 확인), 신규 파일은 테스트뿐.

→ resolution 으로 코드 동작이 바뀌지 않았고(주석 + 신규 테스트만) WARNING 전건 해소. fresh `/ai-review --commit HEAD` 로 stale 검토 갱신.
