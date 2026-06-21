# 요구사항(Requirement) 리뷰 결과

리뷰 대상: M-2 OAuth strategy 전용 단위 테스트 + ai-review resolution
커밋: `21ecd609`

---

## 발견사항

### **[INFO]** 기능 완전성 — 모든 WARNING 항목이 정확히 해소됨
- 위치: `oauth-provider-strategy.spec.ts` 전체 (502줄, 31 케이스)
- 상세: 이전 리뷰(17_32_11 SUMMARY)가 지적한 WARNING 7건 중 6건(Testing)은 신규 spec 파일로, 1건(Requirement WARNING 7 — envCredentials 주석 불명확)은 `integration-oauth.service.ts` 주석 추가로 해소됐다. 커밋 메시지가 정확히 31개 케이스라 명시했고, 파일 라인 수 502줄과 일치한다.
- 제안: 없음 (완전 해소 확인).

### **[INFO]** 엣지 케이스 — `thrownCode` 헬퍼가 `DID_NOT_THROW` 분기를 명시적으로 반환
- 위치: `oauth-provider-strategy.spec.ts:134–142`
- 상세: `thrownCode` 헬퍼는 예외가 발생하지 않으면 `'DID_NOT_THROW'`를 반환하므로, 예외 경로 검증 테스트가 예외 미발생 시 잘못된 통과가 아닌 명확한 어서션 실패를 낸다. `getResponse()` 가 없는 예외에 대해서는 `'NO_CODE'`로 안전하게 처리한다.
- 제안: 없음.

### **[INFO]** spec fidelity — Cafe24 scope 인코딩 테스트가 spec과 정확히 일치
- 위치: `oauth-provider-strategy.spec.ts:291–293`
- 상세: `spec/2-navigation/4-integration.md §5.8` 본문이 "Cafe24는 RFC 6749 §3.3의 공백 구분이 아닌 **콤마 구분** scope를 요구"하고 "공백/`+`으로 보내면 `invalid_scope`로 거부된다"고 명시한다. 테스트는 `scope=mall.read_product%2Cmall.write_product`(URL-encoded comma)를 명시적으로 검증한다. 일치.

### **[INFO]** spec fidelity — Cafe24 `parseTokenExpiresAt` 우선순위가 spec Rationale과 일치
- 위치: `oauth-provider-strategy.spec.ts:383–418`
- 상세: `spec/2-navigation/4-integration.md §5.8` Rationale "Cafe24 token 만료 SoT — JWT exp 격상"은 **JWT `exp` 우선 → 표준 `expires_in` → `expires_at` ISO(TZ-less → `+09:00` 정규화) → 2h default** 우선순위를 명시한다. 테스트 케이스 `parseTokenExpiresAt — JWT exp wins over everything`(383줄), `parseTokenExpiresAt — expires_in next, TZ-less expires_at normalized to KST, else 2h default`(394줄)가 이 4단계 전부를 직접 검증한다. 일치.

### **[INFO]** spec fidelity — MakeShop scope wire format이 spec과 일치
- 위치: `oauth-provider-strategy.spec.ts:487–501`
- 상세: `spec/2-navigation/4-integration.md §5.9` "scope wire format = 공백 구분(표준) — cafe24의 콤마 예외 미적용"이 명시된다. 테스트 `buildAuthorizeUrl — space scopes + PKCE S256`에서 `scope=read+write`(공백 구분, URL-encoded)를 검증한다. 일치.

### **[INFO]** spec fidelity — MakeShop PKCE S256 강제 요구사항이 spec과 일치
- 위치: `oauth-provider-strategy.spec.ts:503–514`
- 상세: `spec/2-navigation/4-integration.md §5.9` "인증 = Authorization-Code + PKCE(OAuth 2.1)"가 명시된다. 테스트 `buildAuthorizeUrl — missing codeChallenge throws MAKESHOP_PKCE_REQUIRED`가 PKCE 없는 요청을 정확한 오류 코드로 거부함을 검증한다. 일치.

### **[INFO]** spec fidelity — Cafe24 Basic auth 전용(body에 client creds 없음) 검증이 spec과 일치
- 위치: `oauth-provider-strategy.spec.ts:308–325`
- 상세: `spec/2-navigation/4-integration.md §5.8`(토큰 교환 endpoint: Basic auth `client_id:client_secret`)과 `cafe24-oauth.strategy.ts`의 주석 "Cafe24의 token endpoint는 Basic auth only 요구. body에 client_id/client_secret을 같이 넣으면 `invalid_request`로 거부"가 명시된다. 테스트가 `body.get('client_id')` / `body.get('client_secret')`이 `null`임을 검증한다. 일치.

### **[INFO]** 의도와 구현 간 괴리 — `envCredentials` 주석이 실제 동작을 정확히 설명
- 위치: `integration-oauth.service.ts:1078–1080`
- 상세: 추가된 주석 "`envCredentials` is always passed (env.cafe24 for cafe24) but only the env-backed strategies read it: cafe24-private and makeshop ignore it and use the per-install creds from `providerMeta` instead."가 `cafe24-private.strategy.ts`의 `resolveCredentials`(providerMeta에서 읽음)와 `makeshop.strategy.ts`의 `buildTokenRequest`(pm.client_id/secret 사용, envCredentials 무시) 동작을 정확히 설명한다. 의도와 구현 일치.

### **[INFO]** MakeShop `parseTokenExpiresAt` 우선순위 — 구현과 테스트 불일치 없음, 단 spec 미명시
- 위치: `oauth-provider-strategy.spec.ts:558–588`
- 상세: 테스트는 `expires_in → expires_at → JWT exp → 1h default` 순서를 검증한다. `makeshop.strategy.ts:94–104`의 실제 구현 순서(expires_in → expires_at → JWT exp → 1h default)와 정확히 일치한다. `spec/2-navigation/4-integration.md §5.9`는 TTL "~1h"만 언급하고 4단계 우선순위를 명시하지 않는다. Cafe24에 대해 Rationale에 명시적 precedence rule이 있는 것과 비교하면 MakeShop의 만료 우선순위는 spec 본문에서 누락된 세부사항이다. 구현과 테스트는 일관성이 있으므로 코드 버그는 아니다.
- 제안: 코드 유지. spec/2-navigation/4-integration.md §5.9 또는 MakeShop 노드 spec에 `parseTokenExpiresAt` 우선순위(expires_in → expires_at → JWT exp → 1h default)를 Rationale 또는 본문으로 보강하면 Cafe24 Rationale과 대칭을 이룬다(project-planner 위임).

### **[INFO]** `resolveOAuthStrategy` cafe24 `appType` 미전달 시 public 기본값 — 명시적 검증
- 위치: `oauth-provider-strategy.spec.ts:164–168`
- 상세: `index.ts:35–37`의 `appType === 'private' ? cafe24Private : cafe24Public` 분기에서 `undefined` 전달 시 public으로 기본 처리된다. 테스트 "No appType → public default"가 이를 명시적으로 검증한다. 기능 완전성 확인.

### **[INFO]** 데이터 유효성 — `emptyEnvCreds` 테스트 패턴이 실제 검증 경계를 정확히 포착
- 위치: `oauth-provider-strategy.spec.ts:145`, `standard-oauth.strategy.ts:42–50`
- 상세: `StandardOAuthStrategy.buildTokenRequest`는 `!clientId || !clientSecret`으로 빈 문자열을 invalid로 처리한다. 테스트에서 `emptyEnvCreds = { clientId: '', clientSecret: '' }`를 사용해 이 경계값을 직접 테스트한다. 일치.

### **[INFO]** `extractProviderMeta` — Google `account_email` null fallback 검증 완전성
- 위치: `oauth-provider-strategy.spec.ts:244–254`
- 상세: `google.strategy.ts:11–15`에서 `readString(data, 'account_email') ?? readString(data, 'email')`로 구현한다. 테스트가 `account_email` 우선, `email` 폴백, 둘 다 없을 때 `{ account_email: null }` 세 경우를 모두 검증한다. 완전.

---

## 요약

이번 커밋은 behavioral change 없이 주석 1건과 신규 테스트 파일(`oauth-provider-strategy.spec.ts`, 31 케이스)만 추가한다. 모든 테스트가 `spec/2-navigation/4-integration.md`의 요구사항(Cafe24 콤마-scopes, JWT exp 우선순위, MakeShop PKCE S256 강제, Basic auth 전용 토큰 교환, cafe24-private credential 소스 등)과 line-level로 일치한다. 이전 리뷰(17_32_11)의 WARNING 7건은 전건 해소됐으며, 기능 정확성 버그나 요구사항 미충족은 발견되지 않았다. MakeShop `parseTokenExpiresAt` 우선순위가 spec 본문에 미명시된 것은 코드 버그가 아닌 spec 갱신 누락 후보다.

## 위험도

NONE
