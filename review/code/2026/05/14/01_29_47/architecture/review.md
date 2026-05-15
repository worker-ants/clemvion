### 발견사항

---

**[CRITICAL] IntegrationsModule이 nodes 레이어에 의존 — 레이어 역전**
- 위치: `integrations.module.ts:22, 47-48`
- 상세: `IntegrationsModule`이 `../../nodes/integration/cafe24/cafe24-api.client`를 import하고 export한다. 의존 방향이 `integrations(infrastructure) → nodes(domain)` 으로 역전되어 있다. 기존 구조는 nodes가 integrations를 소비하는 방향인데, 이 변경으로 양방향 의존이 생긴다. `ExecutionEngineService`가 `Cafe24ApiClient`를 주입받아 `HandlerDependencies`로 전달하는 경로 전체가 이 레이어 위반 위에 세워져 있다.
- 제안: `Cafe24ApiClient`를 별도의 `Cafe24Module`(또는 `NodesModule`)에 등록하고, `ExecutionEngineModule`이 이를 import하도록 이동. `IntegrationsModule`은 순수하게 통합 도메인 로직만 보유.

---

**[CRITICAL] ExecutionEngineService가 특정 벤더 클라이언트를 직접 주입받음 — OCP 위반**
- 위치: `execution-engine.service.ts:78, 421, 600-601`
- 상세: 핵심 오케스트레이션 서비스가 `Cafe24ApiClient`라는 구체 클래스에 의존한다. 다음 외부 서비스 통합(예: Shopify, Naver Commerce)이 추가될 때마다 `ExecutionEngineService`를 수정해야 하는 구조다. 현재 다른 노드들(HTTP, DB, Email)은 이런 방식으로 ExecutionEngine에 주입되지 않는다.
- 제안: `HandlerDependencies`를 완전히 제거하거나, `ApiClientRegistry` 같은 맵 기반 레지스트리를 통해 서비스 타입 → 클라이언트를 동적으로 해소. 또는 `Cafe24Handler`가 NestJS DI를 통해 직접 `Cafe24ApiClient`를 받도록 재설계.

---

**[CRITICAL] OAuthBeginDto에 provider-specific 필드 혼재 — SRP/OCP 위반**
- 위치: `integration.dto.ts:235-285`, `integrations.controller.ts:161-179`
- 상세: 제네릭 OAuth DTO에 `mallId`, `appType`, `clientId`, `clientSecret` 같은 Cafe24 전용 필드가 추가되었고, 컨트롤러에서 `if (body.service === 'cafe24')` 분기로 `providerMeta`를 조립한다. 새 OAuth 제공자가 추가될 때마다 DTO와 컨트롤러 양쪽을 수정해야 한다.
- 제안: `providerMeta: Record<string, unknown>` 단일 필드를 DTO에 추가하고, 프런트엔드가 provider별 메타를 직접 채워 전달하는 방식으로 변경. 컨트롤러는 투명하게 통과시키고, 서비스 레이어에서 provider별 검증 수행.

---

**[WARNING] "MCP-capable" 서비스 타입이 여러 곳에 하드코딩 — 확장성 취약**
- 위치: `candidate-lookup.service.ts:163`, `detect-pending-user-config.ts:61`, `mcp-server-selector.tsx:70`, `ai-agent.component.ts:27-34`
- 상세: `['mcp', 'cafe24']` 배열과 `Cafe24McpToolProvider` 등록이 4개 이상의 파일에 분산되어 있다. 다음 Internal Bridge 통합(예: Naver, Shopify)이 추가될 때 모든 위치를 함께 수정해야 하며, 누락 시 조용한 버그가 발생한다.
- 제안: `MCP_CAPABLE_SERVICE_TYPES = ['mcp', 'cafe24'] as const` 같은 상수를 단일 위치(예: `service-registry.ts` 또는 별도 constants 파일)에 정의하고 모든 소비자가 참조. `Cafe24McpToolProvider` 등록도 플러그인 배열로 추상화.

---

**[WARNING] 도구 제공자 순서에 암묵적 의존 — 깨지기 쉬운 구조**
- 위치: `ai-agent.component.ts:27-34` 주석
- 상세: `Cafe24McpToolProvider`가 `McpToolProvider`보다 반드시 먼저 등록되어야 한다는 순서 의존이 주석으로만 문서화되어 있다. 코드 재정렬 시 런타임에야 발견되는 버그가 발생할 수 있다.
- 제안: `AgentToolProvider.priority: number` 같은 우선순위 필드를 인터페이스에 추가하고 `AiAgentHandler`가 정렬 후 매칭하거나, `matches()` 로직을 `McpToolProvider`가 cafe24 sid를 제외하도록 변경하여 순서 독립적으로 만들기.

---

**[WARNING] `__resetCafe24LocksForTesting` — 테스트 관심사가 프로덕션 모듈 경계를 침범**
- 위치: `cafe24-api.client.ts` (spec 파일 import 기준)
- 상세: 테스트 전용 리셋 함수가 프로덕션 모듈에서 export된다. Jest 환경이 아닌 곳에서도 노출되어 있으며, Tree-shaking이 없는 환경에서는 번들에 포함된다.
- 제안: `Symbol` 기반 module-private 상태 또는 Jest의 `jest.resetModules()`를 활용하거나, 테스트 전용 서브패스(`cafe24-api.client.test-utils.ts`)로 분리.

---

**[WARNING] `providerMeta: Record<string, unknown>` — 타입 안전성 부재**
- 위치: `integration-oauth-state.entity.ts:72-84`
- 상세: `providerMeta`가 `Record<string, unknown>`이라 Cafe24 전용 필드(`mall_id`, `app_type`, `client_id`, `client_secret`)에 대한 컴파일 타임 검증이 없다. 이미 서비스 코드에서 타입 단언이 필요한 패턴이 생겨날 것이다.
- 제안: `type ProviderMeta = Cafe24ProviderMeta | null`처럼 discriminated union을 정의하고, 엔티티에는 그대로 `Record<string, unknown>`을 유지하되 서비스 레이어 경계에서 narrowing 함수로 타입 확정.

---

**[INFO] 프런트엔드-백엔드 리소스 목록 중복**
- 위치: `integration-configs.tsx:248-268` vs `metadata/types.ts:CAFE24_RESOURCES`
- 상세: Cafe24 18개 리소스 목록이 백엔드 metadata와 프런트엔드 UI에 각각 독립적으로 정의되어 있다. 리소스 추가/제거 시 양쪽을 동기화해야 한다.
- 제안: tRPC, OpenAPI codegen, 또는 공유 패키지를 통해 단일 진실 소스에서 생성. 단기적으로는 E2E 테스트로 불일치를 감지.

---

**[INFO] `cafe24NodeComponent`에서 `cafe24ApiClient` undefined 시 런타임 오류**
- 위치: `cafe24.component.ts:16`, `node-component.interface.ts:272-274`
- 상세: `cafe24ApiClient`가 `HandlerDependencies`에서 optional이지만, `Cafe24Handler` 생성자가 이를 그대로 받는다. 연결이 빠진 경우 실행 시점까지 오류가 지연된다.
- 제안: `createHandler`에서 `if (!deps.cafe24ApiClient) throw new Error(...)` 방어 코드 추가, 또는 startup 검증으로 early-fail.

---

### 요약

이번 Cafe24 통합 구현은 metadata-driven 설계(18개 리소스 파일, `findCafe24Operation` 조회), `Cafe24McpToolProvider`의 sid 기반 라우팅, nullable JSONB `providerMeta`의 backward-compatible 확장 등 국소적으로는 잘 설계된 패턴을 사용한다. 그러나 전체 레이어 구조 측면에서 세 가지 Critical 문제가 있다: `IntegrationsModule`이 nodes 레이어 구체 클래스를 역방향으로 의존하고, `ExecutionEngineService`(핵심 오케스트레이터)가 벤더 클라이언트를 직접 주입받으며, 제네릭 OAuth DTO가 provider-specific 필드로 오염된다. 이 세 구조적 문제는 다음 통합 추가 시 전파 비용을 높이며, 현재도 "MCP-capable 서비스" 목록이 4개 파일에 분산되어 있다는 점에서 유지보수 부채가 이미 시작되었다.

### 위험도

**HIGH**