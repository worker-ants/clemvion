### 발견사항

---

**[WARNING] `OAuthBeginDto`에 공급자별 필드 직접 추가 — OCP 위반**
- 위치: `integration.dto.ts` +237–306, `integrations.controller.ts` +161–175
- 상세: `OAuthBeginDto`는 모든 OAuth 공급자가 공유하는 DTO인데, Cafe24 전용 필드(`mallId`, `appType`, `clientId`, `clientSecret`)가 평면적으로 추가되었다. Shopify·Naver Smartstore 등 다음 공급자가 추가될 때마다 같은 방식으로 필드가 누적되면 "God DTO" 안티패턴이 된다. 컨트롤러가 `body.service === 'cafe24'` 조건으로 직접 라우팅하는 것도 OCP 위반이다.
- 제안: `providerMeta?: Record<string, unknown>` 단일 필드를 DTO에 두고, 공급자별 shape 검증은 서비스 레이어의 전략(strategy) 또는 팩토리 패턴으로 위임한다. 컨트롤러 조건 분기도 제거된다.

---

**[WARNING] `HandlerDependencies`에 공급자별 옵셔널 클라이언트 축적 패턴**
- 위치: `node-component.interface.ts` +273–275, `execution-engine.service.ts` +421, +601
- 상세: `cafe24ApiClient?: Cafe24ApiClient`를 `HandlerDependencies`에 옵셔널로 추가하는 패턴은 새 통합이 추가될 때마다 이 인터페이스와 `ExecutionEngineService` 생성자가 커진다. 이미 생성자 주입이 많은 God Service에 더 많은 의존성이 쌓이는 구조다. `cafe24.component.ts`의 `createHandler`는 `deps.cafe24ApiClient`가 `undefined`일 때 `Cafe24Handler`에 그대로 전달하는데, 핸들러가 이를 방어하지 않으면 런타임에 조용히 실패할 수 있다.
- 제안: `integrationClients: Map<string, unknown>` 또는 `getClient(serviceType)` 팩토리를 `HandlerDependencies`에 두거나, `Cafe24ApiClient`를 NestJS DI로 노드 핸들러에 직접 주입하는 방식을 검토한다.

---

**[WARNING] `__resetForTesting()` 공개 메서드가 프로덕션 클래스에 존재**
- 위치: `cafe24-mcp-tool-provider.spec.ts` +268–270 (호출부), `cafe24-mcp-tool-provider.ts` (구현부 — diff 생략)
- 상세: 테스트 전용 상태 초기화 메서드가 프로덕션 클래스에 공개 멤버로 노출되어 있다. 이 패턴은 테스트 인프라와 프로덕션 코드의 경계를 무너뜨린다.
- 제안: 실행 세션 상태 맵을 생성자 파라미터로 주입받아 테스트에서 직접 교체하거나, `@VisibleForTesting`을 표시한 `protected` 메서드로 격리한다.

---

**[WARNING] `Cafe24McpToolProvider` 등록 순서에 묵시적 우선순위 의존**
- 위치: `ai-agent.component.ts` +25–38
- 상세: Cafe24 provider가 반드시 `McpToolProvider` 앞에 위치해야 한다는 요구사항이 배열 순서라는 암묵적 규약으로만 존재한다. 주석으로 설명되어 있지만, `AgentToolProvider` 인터페이스에 `priority` 또는 `order` 개념이 없으므로 코드 리팩토링 시 순서가 바뀌어도 컴파일 오류가 발생하지 않는다.
- 제안: `AgentToolProvider`에 `readonly priority: number` 필드를 추가하고 `AiAgentHandler`가 정렬 후 dispatch하도록 하거나, 최소한 순서 역전을 검출하는 단위 테스트를 추가한다.

---

**[INFO] 프론트엔드에서 `CAFE24_RESOURCES` 재정의 — DRY 경계 위반**
- 위치: `integration-configs.tsx` +248–267 vs `metadata/types.ts`의 `CAFE24_RESOURCE_LABELS`
- 상세: 18개 리소스 목록과 레이블이 백엔드 `types.ts`와 프론트엔드 `integration-configs.tsx` 양쪽에 독립적으로 선언되어 있다. 리소스가 추가·변경될 때 두 곳을 동시에 업데이트해야 한다.
- 제안: 공유 패키지나 코드 생성(API에서 자동 생성)을 고려하거나, 현재 구조 한계 내에서라면 백엔드 `/api/nodes/cafe24/metadata` 엔드포인트를 통해 프론트가 동적으로 리소스 목록을 조회하는 방식을 검토한다.

---

**[INFO] `process.env` 직접 변형으로 병렬 테스트 신뢰성 저하**
- 위치: `integration-oauth.service.cafe24.spec.ts` +42–45, +53–54
- 상세: `beforeEach`/`afterEach`에서 `process.env`를 직접 쓰고 지우는 방식은 Jest 워커 내 테스트가 병렬로 실행될 경우 환경 변수 누수가 생길 수 있다.
- 제안: `jest.replaceProperty(process, 'env', { ...process.env, CAFE24_CLIENT_ID: '...' })` 또는 `ConfigService`를 mock 주입으로 대체한다.

---

**[INFO] `MCP_CAPABLE_SERVICE_TYPES_LIST` 중복 export**
- 위치: `mcp-capable-service-types.ts` +18–20
- 상세: `as const` 튜플과 `string[]` 버전을 모두 export하는 것은 타입 안전성을 일부 포기하는 거래다. TypeORM 쿼리 빌더가 `string[]`을 요구한다는 이유가 주석에 명시되어 있으나, 호출 지점에서 `[...MCP_CAPABLE_SERVICE_TYPES]`로 인라인 확산하는 것이 더 명시적이다.
- 제안: `MCP_CAPABLE_SERVICE_TYPES_LIST` export를 제거하고 호출 지점에서 spread 사용.

---

### 요약

전체적으로 아키텍처 설계는 명확한 의도를 가지고 있다. `nodes → modules` 단방향 의존성 규약이 유지되고 있으며, 메타데이터 기반 디스패치로 새 엔드포인트 추가 비용을 최소화한 점, `MCP_CAPABLE_SERVICE_TYPES` 단일 진실 상수 도입, 암호화 transformer 재사용 등은 설계 완성도가 높다. 다만 **`OAuthBeginDto`의 공급자별 필드 오염과 `HandlerDependencies` 누적 패턴**은 다음 통합 공급자(Shopify 등)가 추가될 때 동일한 방식으로 확장되면 유지보수 부채가 선형 이상으로 쌓일 수 있어 중기적으로 리팩토링이 권장된다. 현재 구현 자체는 기능 정확성과 보안 방어(SSRF 방어, AES-256-GCM 암호화, printable-ASCII guard)가 잘 적용되어 있어 즉각적인 위험도는 낮다.

### 위험도

**LOW**