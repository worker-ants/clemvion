### 발견사항

---

**[CRITICAL] 테스트·구현 불일치 — OAuthState `mode` 값**
- 위치: `integration-oauth.service.ts` `handleInstall()` L652 / `integration-oauth.service.cafe24.spec.ts` L339
- 상세: `handleInstall`이 `stateRepository.create`를 호출할 때 `mode: 'reauthorize'`로 저장하지만, 테스트는 `expect(savedState.mode).toBe('reconnect')`를 단언한다. 이 테스트는 현재 코드로 실행 시 실패한다. 더 나아가 callback 흐름에서 `record.mode === 'reauthorize'`를 체크해 credentials 업데이트 경로를 결정하므로, 실제 값이 `'reconnect'`라면 callback 로직이 의도와 다르게 분기될 수 있다.
- 제안: 구현 또는 테스트 중 하나를 실제 OAuthState mode enum에 맞게 정정. `'reconnect'`가 유효한 값이라면 서비스 코드를 수정, `'reauthorize'`가 맞다면 테스트를 수정.

---

**[WARNING] Breaking Change — `BeginResult` 유니온 타입으로 변경**
- 위치: `integration-oauth.service.ts` L77–86 / `frontend/src/lib/api/integrations.ts` L178–187
- 상세: 기존 `BeginResult`는 `{ authUrl: string; state: string }` 단일 타입이었다. 이제 Cafe24 Private 앱 호출 시 `{ mode: 'cafe24_private_pending', integrationId, appUrl, callbackUrl }`이 반환된다. TypeScript 클라이언트는 컴파일 시 잡히지만, `reauthorize()`, `requestScopes()` 등의 함수 시그니처가 `Promise<BeginResult>`로 변경되어 기존 호출부가 `authUrl`을 무조건 존재하는 것으로 가정하고 있다면 런타임 에러가 발생한다. 프론트엔드의 `reauthorize()` API 메서드는 여전히 `Promise<{ authUrl: string; state: string }>`로 좁혀져 있어 타입 불일치 상태다.
- 제안: `integrations.service.ts`의 `reauthorize`와 `requestScopes` 반환 타입이 `BeginResult`로 변경됐다면 프론트엔드 API 클라이언트도 동기화해야 한다. 혹은 해당 엔드포인트들은 Cafe24 Private 경로가 불가능하므로 좁힌 타입을 유지하되 서비스 레이어도 narrowed type으로 돌려주도록 오버로딩 처리.

---

**[WARNING] `client_secret`이 암호화되지 않은 `providerMeta`에 저장됨**
- 위치: `integration-oauth.service.ts` `handleInstall()` L686–691
- 상세: `providerMeta`에 `client_secret`을 포함해 OAuth state row에 저장하고 있다. `integration.credentials`는 `encryptedJsonTransformer`로 암호화되지만, `oauth_state.providerMeta`(JSONB)가 같은 transformer로 보호되지 않는다면 `client_secret`이 DB에 평문으로 저장된다. callback 이후에도 `state` row가 즉시 삭제되지 않는다면 노출 창이 열린다.
- 제안: `providerMeta`에 `client_secret` 포함을 피하거나, callback 처리 시 `integration.credentials`(이미 암호화됨)에서 직접 읽도록 변경. 또는 `oauth_state` 테이블의 `provider_meta` 컬럼에도 동일한 암호화 transformer 적용.

---

**[WARNING] 에러 응답 형식 불일치 — `cafe24Install` 핸들러**
- 위치: `integrations.controller.ts` L224–234
- 상세: 새 `cafe24Install` 엔드포인트는 try/catch로 예외를 직접 처리해 `res.status(status).json({ code, message })`를 반환한다. 나머지 엔드포인트들은 NestJS 예외 필터를 통해 `{ statusCode, message, error }` 형식으로 반환한다. API 클라이언트가 에러 파싱 로직을 공유하면 이 엔드포인트에서만 파싱이 실패한다.
- 제안: `@Public()` 엔드포인트의 특성상 직접 응답이 불가피하다면, 프로젝트 전역 에러 형식(`{ code, message, statusCode }` 등)을 통일하거나 커스텀 `ExceptionFilter`를 적용.

---

**[WARNING] Swagger 응답 스펙 부정확**
- 위치: `integrations.controller.ts` L192, `@ApiOkResponse({ description: '302 redirect to Cafe24 authorize URL' })`
- 상세: 실제로 302 redirect를 반환하지만 `@ApiOkResponse`(200)로 선언했다. 또한 `oauthBegin`의 `@ApiOkWrappedResponse(OAuthBeginResultDto, ...)` DTO가 신규 `cafe24_private_pending` 응답 형태를 반영하지 않아 Swagger 문서와 실제 응답이 불일치한다.
- 제안: `cafe24Install`에 `@ApiMovedPermanentlyResponse` 또는 커스텀 `@ApiResponse({ status: 302 })` 적용. `OAuthBeginResultDto`에 `cafe24_private_pending` 유니온 형태 추가.

---

**[WARNING] `ListStatusFilter`에 `pending_install` 미포함**
- 위치: `frontend/src/lib/api/integrations.ts` L4–8
- 상세: `IntegrationStatus`에 `pending_install`이 추가됐지만 `ListStatusFilter`는 업데이트되지 않았다. `GET /integrations?status=pending_install` 필터링이 불가능하며, pending 상태의 연동 목록만 조회하는 관리 시나리오를 지원하지 못한다.
- 제안: `ListStatusFilter`에 `"pending_install"` 추가 및 백엔드 필터 로직 확인.

---

**[INFO] `GET /oauth/install/cafe24` — Rate Limiting 미적용**
- 위치: `integrations.controller.ts` L188
- 상세: 이 Public 엔드포인트에 `@Throttle()` 데코레이터가 없다. HMAC 실패 시 403을 반환하므로 직접적 악용은 어렵지만, 대량 요청으로 `pending_install` 통합 전체를 반복 조회하는 DoS 벡터가 열려 있다.
- 제안: `@Throttle({ default: { limit: 20, ttl: 60_000 } })` 수준의 기본 제한 추가.

---

**[INFO] QueryBuilder에서 전체 `pending_install` 통합 풀 로딩**
- 위치: `integration-oauth.service.ts` `handleInstall()` L643–648
- 상세: `mall_id` 필터 없이 모든 `pending_install` cafe24 통합을 메모리로 로드한 뒤 HMAC을 순회 검증한다. 운영 환경에서 pending 건이 많을 경우 성능 저하 및 불필요한 credentials 복호화가 발생한다.
- 제안: `.andWhere("i.credentials->>'mall_id' = :mallId", { mallId: query.mall_id })`처럼 DB 레벨에서 `mall_id`로 먼저 필터링하거나, `mall_id`에 인덱스 추가.

---

### 요약

이번 변경은 Cafe24 Private 앱의 새로운 App URL 기반 OAuth 흐름을 추가하는 것으로, 전반적인 설계 방향은 타당하다. 그러나 **Critical** 수준의 테스트·구현 불일치(`mode: 'reauthorize'` vs 테스트의 `'reconnect'` 단언)가 존재하며, `BeginResult` 유니온 타입 변경으로 인한 잠재적 런타임 breaking change, `client_secret`의 암호화되지 않은 OAuth state 저장, 에러 응답 형식 불일치 등 API 계약 신뢰성에 영향을 주는 Warning 수준 이슈가 다수 발견된다. 신규 엔드포인트의 Swagger 스펙도 실제 동작(302 redirect)을 정확히 반영하지 않아 클라이언트 통합 시 혼란을 줄 수 있다.

### 위험도
**HIGH**