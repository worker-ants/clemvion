### 발견사항

- **[INFO]** 테스트 픽스처에 하드코딩된 자격 증명 형태의 값 사용
  - 위치: `integration-oauth.service.cafe24.spec.ts` — `buildFakeCafe24Integration()` 함수, `clientSecret` 필드 (오버라이드 허용)
  - 상세: `buildFakeCafe24Integration` factory 가 `clientId`, `clientSecret`, `scopes` 등 자격 증명 필드를 오버라이드로 받을 수 있도록 설계되어 있다. 현재 diff 에서는 실제 시크릿 값이 하드코딩된 케이스는 없으나, factory 반환 객체의 `credentials` 에 `client_id`, `client_secret` 키가 포함될 수 있다. 테스트 파일에 실제 값이 유입될 경우(예: 복사 실수) 노출될 수 있는 구조다.
  - 제안: 이 항목은 현재 diff 범위에서는 실제 시크릿이 없으므로 심각도는 INFO. 향후 테스트 작성 시 자격 증명 필드에는 항상 `'fake-client-id'`, `'fake-client-secret'` 같은 명시적 더미 값만 사용하고, pre-commit hook 에서 패턴 탐지(`client_secret\s*=\s*['"][^'"]{16,}` 등)를 고려한다.

- **[INFO]** Swagger API description 에 내부 라우팅 구현 세부 정보 노출
  - 위치: `integrations.controller.ts` — `cafe24Precheck` 엔드포인트의 `@ApiOperation` description (변경 후)
  - 상세: 변경된 description 에 `Route order note: 본 경로는 동적 GET /api/integrations/:id 보다 앞에 선언되어야 한다 — 뒤에 선언되면 cafe24 가 :id 로 소비돼 ParseUUIDPipe 가 400 을 일으킨다.` 와 같은 NestJS 내부 라우터 동작 메커니즘 및 구현 구조가 Swagger UI(공개 문서)를 통해 외부에 노출된다. 이 정보 자체가 직접적인 취약점은 아니지만, 공격자에게 내부 API 구조와 우회 가능성에 대한 힌트를 제공한다.
  - 제안: 라우트 순서 관련 주석은 controller 코드 내 JSDoc/일반 주석으로만 유지하고(이미 lines 590-595에 있음), Swagger description 에는 API 사용자 입장의 설명만 기재한다. description 에서 `Route order note` 단락을 제거하거나 내부 전용으로 숨긴다.

- **[INFO]** `cafe24Precheck` 엔드포인트의 워크스페이스 격리 범위 확인 필요
  - 위치: `integrations.controller.ts` — `cafe24Precheck` 메서드 (lines 612-617)
  - 상세: `@WorkspaceId()` 데코레이터로 추출한 `workspaceId` 를 `precheckCafe24Mall(workspaceId, query.mallId)` 에 전달하므로, 다른 워크스페이스의 mall_id 존재 여부가 누출되지 않는 구조다. 그러나 `@WorkspaceId()` 데코레이터의 구현이 JWT 에서 워크스페이스 ID를 추출하는지, 아니면 query/header 파라미터를 그대로 신뢰하는지 이 diff 범위에서는 확인할 수 없다. 후자라면 IDOR(Insecure Direct Object Reference) 가 발생할 수 있다.
  - 제안: `@WorkspaceId()` 데코레이터가 JWT claim 기반으로 동작하는지 인증 코드에서 재확인한다. query/path 파라미터에서 직접 workspaceId 를 받는 구조라면 JWT payload 의 workspace claim 과 교차 검증하는 로직을 추가한다.

- **[INFO]** Rate limit 설정의 우회 가능성 검토
  - 위치: `integrations.controller.ts` — `cafe24Precheck` (`@Throttle({ default: { limit: 60, ttl: 60_000 } })`), `previewTest` (`@Throttle({ default: { limit: 20, ttl: 60_000 } })`)
  - 상세: Rate limit 이 적용되어 있으나, throttler 가 IP 기반인지 사용자 기반인지 diff 범위에서 확인되지 않는다. IP 기반이면 프록시 뒤 공유 IP 환경에서 다수 사용자가 한도를 공유하거나, X-Forwarded-For 스푸핑으로 우회될 수 있다. 분당 60회(precheck)는 공격자가 다른 워크스페이스의 mall_id 존재 여부를 열거(enumeration)하는 데 충분한 빈도일 수 있다.
  - 제안: throttler 를 사용자(JWT sub) 기반으로 설정하고, precheck 응답을 일관된 응답 시간으로 처리해 timing oracle 을 방지한다. 또한 mall_id enumeration 을 막기 위해 워크스페이스 소유 mall_id 에 대해서만 조회하도록 서비스 계층에서 추가 검증한다.

### 요약

이번 변경은 테스트 픽스처 factory 함수(`buildFakeCafe24Integration`) 도입으로 인라인 mock 반복을 통합하고, Swagger description 에 라우트 순서 관련 구현 메모를 추가하며, `Cafe24PrecheckStatus` 타입 선언의 줄바꿈을 정리한 내용이다. 보안 관점에서 CRITICAL 또는 WARNING 수준의 취약점은 발견되지 않았다. 다만 Swagger description 에 내부 NestJS 라우팅 메커니즘이 공개 문서에 노출되는 INFO 수준 문제, `@WorkspaceId()` 데코레이터의 JWT 기반 동작 여부(IDOR 방지) 확인 필요, rate limit 의 사용자 기반 적용 여부 재확인 등 세 가지 INFO 항목이 있다. 기존 인증(`@ApiBearerAuth`), 워크스페이스 격리, 자격 증명 마스킹, `ParseUUIDPipe` 적용, throttler 구성 등 전반적인 보안 설계는 양호하다.

### 위험도

LOW
