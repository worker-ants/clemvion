충분히 읽었습니다. 분석 결과를 정리합니다.

---

## 발견사항

---

### [CRITICAL] God Object — `ExecutionEngineService`가 너무 많은 책임을 보유

- **위치**: `execution-engine.service.ts` 전체, 생성자 ~300–327
- **상세**: 단일 서비스가 아래 모든 책임을 직접 수행한다.
  1. 실행 라이프사이클 관리 (create / run / complete / fail / cancel)
  2. 서브-워크플로 3가지 실행 모드 (inline, sync, async)
  3. 백그라운드 서브그래프 큐잉
  4. 그래프 순회 루프 (pointer-based, back-edge handling)
  5. 폼·버튼·AI Conversation 3종 블로킹 상호작용 상태 머신
  6. NodeExecution DB 퍼시스턴스
  7. WebSocket 이벤트 발행
  8. 핸들러 등록 부트스트랩 (`registerHandlers`)
  9. 서버 재시작 복구 (`recoverStuckExecutions`)
  10. 도메인 유틸 함수 3개 (`buildConversationMeta...`, `buildAiMessageDebug...`, `buildConversationConfig...`)

  생성자 의존성이 14개(repositories 5 + services 9)이며, 파일 크기가 ~2,500+ 라인에 달한다. SRP 위반, High Coupling, Low Cohesion.
- **제안**: 책임 분리. 예: `ExecutionLifecycleService`(상태 전환·DB), `WorkflowTraversalEngine`(그래프 순회), `InteractionWaitManager`(블로킹 상호작용 Promise 관리), `SubWorkflowCoordinator`(인라인/싱크/어싱크 진입점). 도메인 유틸 함수는 별도 `conversation-payload.builder.ts`로 이동.

---

### [CRITICAL] 노드 타입 하드코딩 — OCP 위반

- **위치**: `execution-engine.service.ts` L1102–1107, L1122, L1137, L614–626 (inline), L656–684 (inline) 등 다수
- **상세**: `if (node.type === 'foreach' || node.type === 'loop' || node.type === 'map')`, `if (node.type === 'background')`, `if (node.type === 'parallel')`, `if (node.type === 'form')`, `if (node.type === 'manual_trigger')` 등의 타입 스위치가 `runExecution`과 `executeInline` 양쪽에 중복 존재한다. 새 특수 노드를 추가할 때마다 엔진 코드를 수정해야 한다(OCP 위반).
- **제안**: `NodeHandler` 인터페이스에 `executionRole?: 'container' | 'background' | 'blocking' | 'trigger' | 'default'` 같은 메타데이터를 추가하거나, 엔진에서 노드 카테고리/역할을 조회하는 Strategy 패턴을 도입해 타입 문자열 분기를 제거.

---

### [CRITICAL] `waitForAiConversation`이 `NodeHandler` 인터페이스를 우회

- **위치**: `execution-engine.service.ts` L1678–1688
- **상세**:
  ```ts
  const handler = this.handlerRegistry.get(node.type) as unknown as {
    endMultiTurnConversation: (...) => unknown;
  };
  ```
  `NodeHandler` 인터페이스에 없는 `endMultiTurnConversation`을 duck-typing으로 호출한다. 인터페이스를 통한 추상화가 완전히 무의미해지며, 컴파일 타임 안전성이 없다. 핸들러가 해당 메서드를 구현하지 않으면 런타임 에러.
- **제안**: `ResumableNodeHandler extends NodeHandler` 서브-인터페이스에 `endMultiTurnConversation`을 추가하고, 엔진이 `instanceof` 또는 `'endMultiTurnConversation' in handler` 가드로 narrowing 후 호출.

---

### [WARNING] `runExecution`과 `executeInline` 그래프 순회 로직 중복

- **위치**: `execution-engine.service.ts` L930–1235 (`runExecution`), L460–773 (`executeInline`)
- **상세**: 두 메서드 모두 동일한 순서로 buildGraph → identifyBackEdges → topologicalSort → sortedIndexMap → backEdgeMap → outgoingEdgeMap → pointer 기반 while 루프를 구현한다. 약 200라인의 동일한 로직이 복사되어 있으며, 하나를 수정하면 다른 쪽도 수동으로 동기화해야 하는 드리프트 위험이 있다.
- **제안**: 공통 순회 로직을 `WorkflowGraphTraversal` 클래스 또는 `traverseWorkflow(nodes, edges, context, options)` 함수로 추출하고, 두 메서드가 이를 호출하도록 리팩토링.

---

### [WARNING] `ExecutionContext`에 엔진 내부 런타임 상태 혼재

- **위치**: `node-handler.interface.ts` L60, L26
- **상세**: `ExecutionContext._executedNodes?: Set<string>`와 `structuredOutputCache`는 핸들러 도메인이 아닌 엔진 내부 런타임 상태다. `_` 접두사가 붙어 있지만 핸들러 인터페이스에 노출되어 있어, 핸들러가 실수로 이를 변경할 수 있다. `rawConfig`도 `Object.freeze`를 통해 mutation을 막고 있지만, 엔진-전용 필드가 핸들러 계약 인터페이스에 포함되는 것은 모듈 경계 위반이다.
- **제안**: `EngineRuntimeContext extends ExecutionContext`를 도입하여 엔진 내부 전용 필드를 분리. 핸들러에는 `ExecutionContext`(핸들러가 필요한 것만), 엔진 내부에는 `EngineRuntimeContext`를 사용.

---

### [WARNING] `NodeHandler.execute()` 반환 타입이 `Promise<NodeHandlerOutput> | Promise<unknown>`

- **위치**: `node-handler.interface.ts` L119–123
- **상세**:
  ```ts
  execute(...): Promise<NodeHandlerOutput> | Promise<unknown>;
  ```
  반환 타입 유니온이 `Promise<NodeHandlerOutput | unknown>`과 동일하므로, 호출자는 항상 narrowing이나 캐스팅을 해야 한다(`adaptHandlerReturn`이 이를 흡수). LSP 관점에서 구현체가 `unknown`을 반환해도 컴파일 에러가 없다. 레거시 호환성을 위한 의도라는 주석이 있지만, 타입 안전성 비용이 크다.
- **제안**: 레거시 핸들러 마이그레이션을 완료하고 반환 타입을 `Promise<NodeHandlerOutput>`으로 단일화하거나, `Promise<NodeHandlerOutput | LegacyOutput>`으로 명시적 유니온 정의. `adaptHandlerReturn`의 존재가 이미 정규화 레이어를 만든다면, 인터페이스 레벨에서도 `NodeHandlerOutput`만 허용하도록 강제하는 것이 맞다.

---

### [WARNING] `pendingContinuations` 인-메모리 상태 — 분산 환경 불가

- **위치**: `execution-engine.service.ts` L278–285
- **상세**: 블로킹 노드(Form, Button, AI Conversation)의 재개 Promise를 인스턴스 메모리에 보관한다. 서버 재시작 시 `recoverStuckExecutions`가 FAILED 처리를 하므로 데이터 손실은 없지만, 수평 확장(로드밸런서 뒤 여러 인스턴스) 환경에서는 재개 요청이 다른 인스턴스로 라우팅될 수 있어 No-op이 된다.
- **제안**: 현재 단일 인스턴스 운용이라면 LOW 위험이나, 스케일 아웃 계획이 있다면 Redis pub/sub 또는 BullMQ event reply 패턴으로 교체 필요. 최소한 아키텍처 문서에 "단일 인스턴스 전제" 제약을 명시.

---

### [WARNING] `forwardRef`로 감싼 `WebsocketService` — 순환 의존성 신호

- **위치**: `execution-engine.service.ts` L314
- **상세**: `@Inject(forwardRef(() => WebsocketService))`는 NestJS가 순환 의존성을 감지했다는 신호다. `WebsocketService`가 `ExecutionEngineService`를 참조하고 있어 순환이 발생하는 구조다. 순환 의존성은 모듈 경계가 잘못 설정되었음을 나타낸다.
- **제안**: 이벤트 발행을 인터페이스(`IExecutionEventEmitter`)로 추상화하거나, NestJS의 `EventEmitter2`를 도메인 이벤트 버스로 사용하여 순환 참조 없이 양방향 통신 구현.

---

### [INFO] 테스트가 `private` 멤버를 `as unknown as` 캐스팅으로 접근

- **위치**: `execution-engine.service.spec.ts` L295–298
- **상세**:
  ```ts
  contextService = (
    service as unknown as { contextService: ExecutionContextService }
  ).contextService;
  ```
  private 멤버 접근이 필요한 테스트는 해당 관계가 테스트 가능한 공개 계약으로 표현되지 못하고 있음을 나타낸다. 현재 패턴이 깨지는 리팩토링(필드명 변경 등)에 취약하다.
- **제안**: `executeInline`을 위한 별도 서비스로 분리하면 자연스럽게 해소된다. 또는 해당 의존성을 노출하는 작은 테스트용 팩토리를 제공.

---

### [INFO] `registerHandlers`가 서비스 로케이터 패턴 사용

- **위치**: `execution-engine.service.ts` L362–372
- **상세**: `componentRegistry.bootstrap(ALL_NODE_COMPONENTS, { llmService, ragSearchService, ... })`는 핸들러 생성에 필요한 서비스들을 객체 맵으로 전달하는 서비스 로케이터 패턴이다. NestJS DI 컨테이너를 우회하며, 핸들러 의존성이 타입 시스템에서 불투명해진다.
- **제안**: 각 핸들러를 NestJS `@Injectable()`로 등록하고 DI 컨테이너가 의존성을 주입하도록 변경. 핸들러 등록은 모듈 레벨에서 선언적으로.

---

## 요약

`ExecutionEngineService`는 워크플로 실행 엔진의 핵심 기능을 구현하고 있으나, 약 2,500라인의 단일 클래스에 그래프 순회, DB 퍼시스턴스, 블로킹 상호작용 상태 머신, 서브-워크플로 조율, WebSocket 이벤트 발행까지 모든 책임이 집중된 God Object다. `runExecution`과 `executeInline`의 그래프 순회 로직 중복, 노드 타입 문자열 분기(OCP 위반), `NodeHandler` 인터페이스 우회(`as unknown as`), `ExecutionContext`에 혼재된 엔진 내부 상태가 핵심 구조적 문제다. 기능은 동작하고 있으나, 확장·테스트·유지보수 비용이 선형이 아닌 초선형(super-linear)으로 증가하는 구조이며, 새 노드 타입이나 상호작용 모드가 추가될수록 위험도가 누적된다.

## 위험도

**HIGH**