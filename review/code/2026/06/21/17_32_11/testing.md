# Testing 리뷰 결과

## 발견사항

### [WARNING] 신설 strategy 파일 7개에 전용 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/` (디렉터리 전체)
- 상세: `cafe24-oauth.strategy.ts`, `cafe24-public.strategy.ts`, `cafe24-private.strategy.ts`, `google.strategy.ts`, `github.strategy.ts`, `makeshop.strategy.ts`, `standard-oauth.strategy.ts`, `index.ts` 모두에 대해 `oauth-providers/*.spec.ts` 파일이 하나도 없다. 이 클래스들은 순수 함수형 stateless 로 DI 없이 단독 인스턴스화가 가능하므로 외부 mock 없이 단위 테스트를 작성하기 매우 용이하다. 기존 통합 spec 파일(`integration-oauth.service.cafe24.spec.ts` 등)이 facade 를 통한 end-to-end 경로를 커버하지만, 개별 strategy 의 메서드(`buildAuthorizeUrl`, `buildTokenRequest`, `parseTokenExpiresAt`, `extractProviderMeta`, `buildStubResult`, `describeExchange`)는 strategy 수준에서 독립적으로 검증되지 않는다.
- 제안: `oauth-providers/` 하위에 strategy 별 `.spec.ts` 를 추가하거나, 공통 `oauth-providers.spec.ts` 하나에서 각 전략 클래스를 직접 인스턴스화해 단위 테스트한다. 특히 아래 커버리지 갭 항목들을 우선 대상으로 삼는다.

### [WARNING] `Cafe24OAuthStrategyBase.buildAuthorizeUrl` — mall_id 없을 때의 예외 경로 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/cafe24-oauth.strategy.ts` L790-798
- 상세: `buildAuthorizeUrl` 는 `input.mallId` 가 없으면 `CAFE24_INVALID_MALL_ID` `BadRequestException` 을 던진다. 기존 테스트 suite 는 이 경로를 직접 커버하는 케이스가 없다(기존 테스트는 facade `begin` 레벨에서 mall_id 검증이 더 앞에서 걸리므로 strategy 의 방어 코드에 도달하지 않는다). strategy 를 직접 호출하는 테스트가 없으면 이 예외 분기는 dead-code 처럼 남게 된다.
- 제안: `cafe24PublicOAuthStrategy.buildAuthorizeUrl({ mallId: undefined, ... })` 가 `CAFE24_INVALID_MALL_ID` 를 던지는지 직접 검증하는 단위 테스트 추가.

### [WARNING] `MakeshopOAuthStrategy.buildAuthorizeUrl` — codeChallenge 없을 때의 예외 경로 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/makeshop.strategy.ts` L1423-1429
- 상세: `buildAuthorizeUrl` 는 `input.codeChallenge` 가 없으면 `MAKESHOP_PKCE_REQUIRED` `BadRequestException` 을 던진다. 이 분기도 strategy 직접 테스트 없이는 미검증.
- 제안: `makeshopOAuthStrategy.buildAuthorizeUrl({ codeChallenge: undefined, ... })` 케이스 단위 테스트 추가.

### [WARNING] `Cafe24PrivateOAuthStrategy.resolveCredentials` — 자격증명 누락 예외 경로 단위 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/cafe24-private.strategy.ts` L999-1006
- 상세: `providerMeta` 에서 `client_id` 또는 `client_secret` 이 없을 때 `CAFE24_PRIVATE_APP_CREDENTIALS_REQUIRED` 를 던지는 분기. facade 레벨 통합 테스트가 이 경로를 간접 커버하더라도, strategy 가 단위 테스트 없이 독립 검증되지 않으면 리팩터링 안전망이 약하다.
- 제안: `cafe24PrivateOAuthStrategy.buildTokenRequest({ providerMeta: { mall_id: 'x' }, ... })` 에서 크레덴셜 누락 시 예외를 던지는 단위 케이스 추가.

### [WARNING] `Cafe24OAuthStrategyBase.describeExchange` — mall_id 불일치·scope 부족 진단 경로 직접 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/cafe24-oauth.strategy.ts` L896-925
- 상세: `describeExchange` 는 (1) echoMallId ≠ pm.mall_id 인 경우의 warning, (2) 요청 scope > 부여 scope 인 경우의 warning, (3) 정상 info 라인 세 분기가 있다. 이 메서드는 facade 의 `diagnostics?.warnings` / `diagnostics?.info` for-loop 로 소비되는데, 각 분기가 실제로 올바른 메시지를 생성하는지 직접 검증하는 테스트가 없다. 특히 mall_id mismatch 경고는 silent-mismatch 버그 탐지용 핵심 진단인데, 회귀 보호 테스트가 없다.
- 제안: `cafe24PublicOAuthStrategy.describeExchange(result, requestedScopes, providerMeta)` 를 직접 호출하여 (a) echoMallId 불일치 시 `warnings` 에 해당 메시지가 포함되는지, (b) scope 부족 시 `warnings` 에 scope mismatch 메시지가 포함되는지, (c) 정상 시 `info` 에 성공 메시지가 있는지 각각 단위 테스트 추가.

### [WARNING] `parseTokenExpiresAt` — 리팩터링 후 shim 위임으로 인한 테스트 커버리지 질 저하
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/integration-oauth.service.ts` L541-587 (shim) vs 기존 전체 구현 제거
- 상세: `parseTokenExpiresAt` exported 함수는 이제 `resolveOAuthStrategy(provider).parseTokenExpiresAt(data)` 를 그대로 위임하는 1줄 shim 이다. 기존 `integration-oauth.service.cafe24.spec.ts` 의 JWT exp 우선순위 테스트는 facade 경로(`handleCallback` → 내부 strategy 호출)를 통해 동작하므로 여전히 의미가 있다. 그러나 makeshop 의 `parseTokenExpiresAt` 네 가지 분기(expires_in 우선 → expires_at ISO → JWT exp → 1h fallback)를 직접 검증하는 테스트는 `integration-oauth.service.makeshop.spec.ts` 에서 facade 경유로만 존재할 가능성이 높고, strategy 를 직접 호출하는 단위 테스트가 없으면 개별 분기 커버 여부가 불분명하다.
- 제안: `makeshopOAuthStrategy.parseTokenExpiresAt({ expires_in: 3600 })`, `parseTokenExpiresAt({})` (fallback 1h), `parseTokenExpiresAt({ access_token: fakeJwt })` 등 각 분기 단위 테스트 추가. Cafe24 variant 도 동일하게.

### [INFO] `StandardOAuthStrategy.buildStubResult` — provider 필드 확인 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/standard-oauth.strategy.ts` L1870-1882
- 상세: `buildStubResult` 는 `this.provider` 를 accessToken prefix 로 사용하므로 서브클래스별로 다른 provider 값이 반영되는지 검증하는 테스트가 없다. google vs github stub 결과의 `accessToken` prefix 가 다른지 확인하는 케이스가 없어 regression 발생 시 탐지 어려움.
- 제안: `googleOAuthStrategy.buildStubResult([], null).accessToken` 가 `stub-google-` 로 시작하는지, `githubOAuthStrategy.buildStubResult([], null).accessToken` 가 `stub-github-` 로 시작하는지 단위 assert.

### [INFO] `resolveOAuthStrategy` registry — 전체 provider 라우팅 smoke test 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/index.ts` L1318-1334
- 상세: `resolveOAuthStrategy` 는 switch 로 5가지 경우(google/github/makeshop/cafe24-public/cafe24-private)를 반환한다. `appType` 파라미터 없이 `cafe24` 를 넘기면 public 전략이 반환되는 기본 동작이 테스트되지 않는다. 새 provider 추가 시 registry 에 케이스를 누락하면 TypeScript 가 `never` 오류를 잡아주지만(`switch` exhaustiveness), 실행 시 올바른 인스턴스가 반환되는지는 런타임 smoke test 로 보장하는 것이 더 안전하다.
- 제안: `resolveOAuthStrategy('cafe24')` 가 `Cafe24PublicOAuthStrategy` 인스턴스인지, `resolveOAuthStrategy('cafe24', 'private')` 가 `Cafe24PrivateOAuthStrategy` 인스턴스인지 assert 하는 단위 테스트 추가.

### [INFO] `GitHubOAuthStrategy.extractProviderMeta` — `login` null 케이스 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/github.strategy.ts` L1151-1153
- 상세: `readString(data, 'login')` 이 null 을 반환할 때 `{ login: null }` 이 저장되어 credentials 에 불필요한 null 필드가 생긴다. 기존 google 전략도 `account_email` nullable 처리와 동일 패턴이나, 두 전략 모두 null 값 포함 providerMeta 가 저장되는 경우를 직접 검증하지 않는다. null 필드 누적 여부가 후속 로직에 영향을 줄 수 있다.
- 제안: `githubOAuthStrategy.extractProviderMeta({})` 결과의 `login` 이 `null` 임을 assert 하거나, 의도적으로 null 을 제외한다면 `if (login)` guard 추가 후 테스트.

## 요약

이번 리팩터링(M-2)은 2,600줄 facade 내부의 provider if/else 체인을 5개 strategy 클래스로 분리한 구조 개선이다. 커밋 메시지에서 "unit PASS (integrations 446)" 으로 기존 테스트 통과가 확인되어 facade 레벨 회귀는 방지되었다. 그러나 신설된 `oauth-providers/` 디렉터리에 전용 단위 테스트 파일이 전혀 없고, strategy 클래스들의 각 메서드(buildAuthorizeUrl 방어 분기, buildTokenRequest 크레덴셜 검증, parseTokenExpiresAt 멀티 분기, describeExchange 진단 메시지)가 facade 경유 통합 테스트에만 간접 의존하고 있다. strategy 들이 stateless pure 클래스로 DI 없이 직접 인스턴스화가 가능한 구조임에도 단위 테스트가 없는 것은 이 패턴이 제공하는 테스트 용이성의 이점을 살리지 못한 상태다. 특히 `describeExchange` 의 mall_id mismatch 진단과 `MakeshopOAuthStrategy`의 PKCE guard, Cafe24 private credential guard 는 실패 시 OAuth 흐름이 조용히 오작동할 수 있는 경로이므로 WARNING 수준의 테스트 추가가 권장된다.

## 위험도

MEDIUM
