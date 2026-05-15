## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] `forwardRef` 순환 의존성 — ExecutionEngine ↔ Websocket**
- 위치: `background-execution.processor.ts:36–37`
- 상세: `BackgroundExecutionProcessor`가 `@Inject(forwardRef(() => WebsocketService))`로 주입받는다. `execution-engine` 모듈이 `websocket` 모듈에 의존하면서, `WebsocketGateway`는 반대로 `ExecutionsModule`을 통해 `BackgroundRunsService`에 의존한다. `forwardRef`는 NestJS가 순환 의존성을 해소하는 임시 방편이지 아키텍처적 해결이 아니다.
- 제안: `BackgroundExecutionProcessor`가 WS 이벤트를 직접 발행하는 대신, **도메인 이벤트(EventEmitter2 또는 NestJS EventBus)**를 발행하고 `WebsocketService`가 이를 구독하도록 방향을 역전시킨다. 의존성 화살표가 `execution-engine → event-bus ← websocket`으로 정리되어 순환이 사라진다.

---

**[WARNING] WebsocketGateway가 채널별 인가 라우터로 성장 중**
- 위치: `websocket.gateway.ts` subscribe 핸들러
- 상세: `execution:`, `workflow:`, `notifications:`, `kb:`, `background:run:` 등 채널 종류가 늘어날수록 게이트웨이 내부에 `if (channel.startsWith(...))` 분기가 선형으로 증가한다. 현재 구조는 새 채널 타입마다 게이트웨이를 수정해야 하므로 OCP(개방-폐쇄) 위반이 된다. `WebsocketGateway`의 단일 책임이 "WS 연결 관리"와 "채널별 인가 정책 판별"로 분리되지 않고 있다.
- 제안: 채널 prefix → `ChannelAuthorizationStrategy` 인터페이스 맵을 도입하고, 각 전략(KbChannelAuth, BackgroundRunChannelAuth 등)을 모듈에서 등록하는 패턴으로 확장. 게이트웨이는 맵을 순회하기만 하면 된다.

---

**[WARNING] `verifyBackgroundRunOwnership`의 raw 테이블명 조인**
- 위치: `background-runs.service.ts:73–79`
- 상세: `innerJoin('execution', 'e', ...)` / `innerJoin('workflow', 'w', ...)` — TypeORM 엔티티 심볼이 아닌 raw 테이블 문자열로 조인한다. `ExecutionsModule`이 `Execution` 엔티티를 등록하지 않은 컨텍스트(e.g., WS gateway가 직접 서비스를 주입받는 경우)에서 런타임 에러가 발생하거나, 테이블명이 바뀌면 TypeScript가 잡지 못한다. 같은 파일의 `verifyExecutionAccess`는 `e.workflow` 를 엔티티 관계로 `.leftJoin('e.workflow', ...)` 처리해 일관성도 깨진다.
- 제안: `innerJoin(Execution, 'e', ...)` 엔티티 참조 방식으로 통일하거나, `e.workflow` relation alias를 사용.

---

**[WARNING] `aggregateBodyStatus`의 status 하드코딩 SQL**
- 위치: `background-runs.service.ts:295–310`
- 상세: `SUM(CASE WHEN ne.status = 'pending' THEN 1 ...)` 등 status 문자열이 TypeScript `NodeExecutionStatus` enum 값과 independently 하드코딩되어 있다. enum 값이 변경되면 쿼리는 조용히 오동작한다.
- 제안: `Object.values(NodeExecutionStatus)` 로부터 동적 CASE를 생성하거나, TypeORM QueryBuilder의 `where('ne.status = :status', { status: NodeExecutionStatus.PENDING })` 패턴으로 enum 참조를 단일화.

---

**[INFO] `BackgroundRunStatus.cancelled` — 타입 정의와 구현 불일치**
- 위치: `background-run-response.dto.ts:7`, `background-runs.service.ts:deriveBackgroundRunStatus`
- 상세: `BackgroundRunStatus`에 `'cancelled'`가 선언되어 있지만 `deriveBackgroundRunStatus`는 절대 `'cancelled'`를 반환하지 않는다. `maxDurationMs` 타임아웃 처리도 현재 구현에 없다. API 응답의 Swagger enum에도 선언되어 있어, 클라이언트가 실제로 수신하지 못할 값을 기대하는 Dead Code가 생긴다.
- 제안: 타임아웃 처리를 구현할 때까지 `'cancelled'`를 타입에서 제거하거나 `TODO` 주석으로 명확히 표시.

---

**[INFO] `BackgroundRunsService.verifyExecutionAccess` — 소유권 검증 로직 중복**
- 위치: `background-runs.service.ts:171–183`
- 상세: 주석에 "ExecutionsService.verifyOwnership 와 동일 의미지만 모듈 분리를 위해 자체 구현"이라고 명시되어 있다. 소유권 검증 정책(NotFound로 통일, IDOR 차단)이 변경될 경우 두 곳을 동시에 수정해야 한다.
- 제안: `ExecutionsModule`이 `verifyOwnership` 메서드를 export하거나, 공통 소유권 검증 로직을 `AuthorizationService` 같은 shared 모듈로 추출하는 중기 개선을 고려.

---

**[INFO] `use-background-run.ts` — eslint-disable로 숨겨진 stale closure 위험**
- 위치: `use-background-run.ts:103`
- 상세: `eslint-disable-next-line react-hooks/exhaustive-deps`로 `queryKey`를 deps 배열에서 제외한다. `queryKey`는 `[QUERY_KEY, executionId, backgroundRunId]`로 생성되는데, `executionId`가 바뀌어도 effect가 재실행되지 않아 이전 `executionId` 기반 캐시 무효화가 일어나지 않는다.
- 제안: deps에 `executionId`와 `backgroundRunId`를 모두 추가하거나, `queryKey`를 `useMemo`로 안정화하고 effect deps에 포함.

---

### 요약

Background 모니터링 API 전반의 레이어 분리(Controller → Service → Repository), cursor 페이지네이션, WebSocket 격리 채널 전략은 아키텍처적으로 일관성 있게 설계되었다. 그러나 `BackgroundExecutionProcessor` → `WebsocketService` 방향의 `forwardRef` 순환 의존성이 가장 중요한 구조적 취약점이다. 이는 `execution-engine` 모듈이 인프라 계층인 `websocket` 모듈을 직접 알아야 하는 레이어 역전으로, 도메인 이벤트 패턴을 도입해 의존성 방향을 역전시켜야 한다. `WebsocketGateway`가 채널별 인가 분기를 직접 보유하며 OCP를 위반하기 시작하는 점도 채널 타입이 늘어날수록 유지보수 부채가 될 수 있다.

### 위험도

**MEDIUM** — 순환 의존성이 런타임에서 `forwardRef`로 회피되고 있으나, 추후 모듈 리팩토링 시 예기치 않은 초기화 순서 문제로 이어질 수 있음. 나머지 항목은 기능 정확성에는 영향이 없는 구조적 개선 사항.