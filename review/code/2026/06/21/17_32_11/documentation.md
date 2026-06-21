# 문서화(Documentation) 리뷰 결과

## 발견사항

### [INFO] `parseTokenExpiresAt` 독스트링이 위임 설명만 남고 우선순위 세부 내용 손실
- 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — `parseTokenExpiresAt` JSDoc (라인 ~2116–2540 범위 삭제 후 남은 shim)
- 상세: 원래 독스트링에는 Cafe24 의 JWT exp 우선순위 4단계, MakeShop 1h TTL fallback, 관련 spec 참조 링크(`spec/2-navigation/4-integration.md Rationale "Cafe24 token 만료 SoT — JWT exp 격상 (2026-05-18)"`)가 모두 기술되어 있었다. 리팩터 후 facade 의 독스트링은 "Thin delegating shim — the per-provider precedence … lives in each strategy under `./oauth-providers`" 로 축약되었다. 실제 우선순위 문서는 `cafe24-oauth.strategy.ts` 의 `parseTokenExpiresAt` JSDoc 및 `makeshop.strategy.ts` 의 JSDoc 으로 이동되었고, 두 파일 모두 해당 내용을 적절히 포함하고 있다. 그러나 `integration-oauth.service.ts` 를 직접 탐색하는 독자 입장에서는 "어느 전략 파일을 봐야 하는지" 안내가 부족하다. 현재의 `./oauth-providers` 참조는 폴더 경로이므로 어느 파일인지 특정되지 않는다.
- 제안: 현재 shim 독스트링에 cafe24 전략 파일(`./oauth-providers/cafe24-oauth.strategy.ts`)과 makeshop 전략 파일(`./oauth-providers/makeshop.strategy.ts`)로의 명시적 파일 참조를 추가하면 탐색 비용이 줄어든다. 필수 수준은 아니며 INFO.

---

### [INFO] `cafe24AuthorizeUrl` / `cafe24TokenUrl` 이 `cafe24-oauth.strategy.ts` 에 `export` 로 공개 — 모듈 외부 사용 의도 불명확
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/cafe24-oauth.strategy.ts` 라인 761–766
- 상세: `cafe24AuthorizeUrl(mallId)`, `cafe24TokenUrl(mallId)` 두 함수가 `export` 로 공개되어 있다. 이전 facade 에서는 private 모듈 내 함수였다. 현재 `index.ts` 는 이들을 재수출하지 않으므로 실질적으로 `oauth-providers` 폴더 내부 전용이지만, export 로 공개되어 있어 향후 외부에서 직접 임포트할 수 있는 여지가 생긴다. 함수 용도가 내부 전용이라면 export를 제거하거나, 외부 노출 의도라면 JSDoc 에 "공개 API" 임을 명시해야 한다. 현재 짧은 한줄 주석(`/** Cafe24 is mall_id-dependent … */`)만 있다.
- 제안: 외부 노출 불필요한 경우 `export` 제거 또는 `index.ts` 에서 의도적으로 제외했음을 주석으로 표기. INFO 수준이며 동작에는 영향 없음.

---

### [INFO] `StandardOAuthStrategy.extractProviderMeta` 가 추상 메서드로 선언되어 있으나 독스트링 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/standard-oauth.strategy.ts` 라인 ~1867
- 상세: `abstract extractProviderMeta(data: Record<string, unknown>): Record<string, unknown>;` 만 있고 어떤 키를 추출해야 하는지, 반환값이 empty object 여도 되는지에 대한 계약이 없다. `OAuthProviderStrategy` 인터페이스의 대응 멤버에는 `/** Extract provider-specific metadata from the token response. */` 라는 짧은 독스트링이 있으나, 구현자가 반환 구조를 이해하기 위한 예시(google: `account_email`, github: `login`, cafe24: `cafe24_operator_id`)가 인터페이스 레벨에 없어 새 provider 추가 시 참조 불편.
- 제안: `OAuthProviderStrategy` 인터페이스의 `extractProviderMeta` JSDoc 에 `@example` 또는 반환 키 규약 한 줄을 추가하면 extensibility 관점에서 유용하다. INFO 수준.

---

### [INFO] `index.ts` 모듈 레벨 JSDoc 과 실제 `resolveOAuthStrategy` 시그니처 사이에 `appType` 기본값 동작 미반영
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/index.ts` 라인 1297–1305 (모듈 JSDoc)
- 상세: 모듈 레벨 주석에 "Cafe24 sub-dispatches on `appType` (public = env creds, private = state-body creds); response parsing … callers that only parse a response may omit `appType` (defaults to public)" 라고 기술되어 있다. 그러나 `resolveOAuthStrategy` 함수 자체에는 독립 JSDoc 블록이 없다. 함수 시그니처 바로 위에 `@param appType` 설명, `@returns` 설명이 JSDoc 으로 추가되면 IDE tooling 에서 자동 표시된다.
- 제안: `resolveOAuthStrategy` 함수에 JSDoc 블록(`@param provider`, `@param appType`, `@returns`) 추가. 현재 모듈 레벨 주석은 개념 설명으로 충분하나 함수 레벨 독스트링이 없어 IDE hover 지원이 약하다. INFO 수준.

---

### [INFO] `Cafe24PrivateOAuthStrategy` 독스트링이 flow 시작 주체를 기술하나 private app 의 `app_type` 필드 검증 위치가 문서화되지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/cafe24-private.strategy.ts` 라인 985–989
- 상세: 클래스 독스트링은 "flow starts from Cafe24 Developers' 테스트 실행" 과 "Credentials are supplied by the user at begin, persisted (encrypted) on the integration row + the OAuth state `provider_meta`" 를 설명한다. 유용한 컨텍스트지만, `providerMeta` 에서 `app_type` 이 이미 `private` 으로 검증된 상태로 도착한다는 선조건(precondition)이 명시되지 않았다. 이 조건은 facade (`exchangeCodeForToken` 내 `const appType = ...` 블록)에서 보장되는데, 독자가 전략 파일만 보면 검증 책임 소재가 불분명하다.
- 제안: 독스트링 또는 `resolveCredentials` 주석에 "facade 가 `providerMeta.app_type === 'private'` 임을 사전 확인 후 이 전략을 선택한다" 를 한 줄 추가. INFO 수준.

---

### [INFO] `MakeshopOAuthStrategy.buildStubResult` 에서 `shop_uid` 를 `providerMeta.makeshop_response_shop_uid` 로 매핑하는 이유가 주석 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/m-2-oauth-strategy-a246b9/codebase/backend/src/modules/integrations/oauth-providers/makeshop.strategy.ts` 라인 ~1503–1507
- 상세: stub 결과에서 `beginMeta.shop_uid` 를 `makeshop_response_shop_uid` 키로 넣는 이유(실제 token 교환 시 response 에서 `shop_uid` 가 오지 않고 state 의 `provider_meta` 에서 facade 가 mirror 하는 구조)가 설명되어 있지 않다. `extractProviderMeta` 의 주석("shop_uid is mirrored from the state's provider_meta by the facade, not the response")과 대조하면 이해 가능하지만, stub 쪽에서도 동일 설명이 있으면 혼선이 줄어든다.
- 제안: `buildStubResult` 내부에 `// shop_uid 는 실제 token response 에 없음 — facade 가 state provider_meta 에서 mirror` 한 줄 추가. INFO 수준.

---

## 요약

이번 M-2 리팩터는 2,612줄의 단일 파일을 9개 파일(`oauth-providers/` 신설 폴더)로 분리한 대규모 구조 개선이다. 문서화 품질은 전반적으로 양호하다. `oauth-provider-strategy.ts` 의 모듈 레벨 JSDoc 은 설계 의도, spec 참조, facade 경계, 싱글턴 패턴을 모두 포함하고 있으며, `Cafe24OAuthStrategyBase`, `MakeshopOAuthStrategy`, `StandardOAuthStrategy` 의 클래스 독스트링도 RFC 준수 여부, 자격증명 출처, PKCE 요구사항 등 핵심 프로토콜 특이사항을 적절히 기술한다. 인라인 주석도 Cafe24 Basic-auth 전용 요구, MakeShop space-scope 등 provider 일탈을 spec 참조와 함께 설명하고 있다. plan 파일(`02-architecture.md`) 체크박스 업데이트도 완료되었다. 개선 여지는 모두 INFO 수준(IDE tooling 지원 강화, 전략 선택 선조건 명문화, 탐색 편의 개선)이며 외부 API 계약이나 동작에 영향을 주는 문서 오류는 발견되지 않았다. README 또는 CHANGELOG 업데이트는 이 변경이 순수 내부 리팩터(외부 동작·API 계약 불변)이므로 불필요하다.

## 위험도

NONE
