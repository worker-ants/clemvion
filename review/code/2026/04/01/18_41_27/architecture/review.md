### 발견사항

---

**[CRITICAL] 순환 의존성: ExecutionEngineModule ↔ WebsocketModule**
- 위치: `execution-engine.module.ts`, `websocket.module.ts`
- 상세: `forwardRef()`로 해결했지만, 이는 증상 완화일 뿐 근본 원인은 아키텍처 설계 문제입니다. `ExecutionEngineService`가 `WebsocketService`를 주입받고, `WebsocketGateway`가 `ExecutionEngineService`를 주입받는 양방향 의존성이 형성되어 있습니다. NestJS에서 `forwardRef`는 부트스트랩 시 초기화 순서 문제를 숨기며, 의존성 그래프 복잡도를 높이고 테스트 설정을 어렵게 합니다.
- 제안: 이벤트 기반 아키텍처로 분리하세요. `EventEmitter2` 또는 NestJS 내장 `EventEmitter`를 이용해 `ExecutionEngineService`는 이벤트를 발행하고, `WebsocketService`는 이를 구독하도록 설계합니다. `WebsocketGateway`는 `ExecutionEngineService`를 직접 참조하는 대신 별도의 `FormSubmissionService`(또는 메시지 버스)를 통해 폼 제출을 처리합니다.

---

**[CRITICAL] ExecutionsController가 ExecutionEngineService를 직접 참조**
- 위치: `executions.controller.ts:19`, `executions.module.ts`
- 상세: 컨트롤러가 `ExecutionsService`를 우회하여 `ExecutionEngineService`를 직접 호출합니다. 레이어 책임 원칙 위반입니다. 컨트롤러는 단일 서비스 진입점만 알아야 하며, `ExecutionEngineModule`을 `ExecutionsModule`이 의존하게 되어 모듈 경계가 훼손됩니다.
- 제안: `continueExecution` 메서드를 `ExecutionsService`에 위임 메서드로 추가하세요. `ExecutionsController`는 `ExecutionsService`만 의존하고, `ExecutionsService`가 내부적으로 `ExecutionEngineService`를 호출하도록 합니다.

```typescript
// executions.service.ts
continueExecution(id: string, formData?: unknown): void {
  this.executionEngineService.continueExecution(id, formData);
}
```

---

**[WARNING] ExecutionEngineService에 인프라 책임 혼재 (SRP 위반)**
- 위치: `execution-engine.service.ts:352~450` (`waitForFormSubmission` 메서드)
- 상세: 실행 엔진 서비스가 다음 세 가지 책임을 동시에 가집니다: (1) 실행 흐름 제어, (2) WebSocket 이벤트 발행, (3) Form 일시정지 상태 관리(`pendingContinuations` Map). 특히 `pendingContinuations`는 인메모리 상태로 애플리케이션이 단일 인스턴스일 때만 동작합니다.
- 제안: `FormWaitService` 등 별도 서비스로 `pendingContinuations` 관리를 분리하세요. 현재 구조는 수평 확장(멀티 인스턴스) 시 폼 제출 요청이 다른 인스턴스로 라우팅되면 `No pending continuation` 오류가 발생합니다. 스펙 범위에서는 허용되나, 주석으로 단일 인스턴스 제약을 명시해야 합니다.

---

**[WARNING] WebsocketGateway가 도메인 서비스를 직접 오케스트레이션**
- 위치: `websocket.gateway.ts:156~183` (`handleSubmitForm`)
- 상세: 게이트웨이(프레젠테이션 레이어)가 도메인 서비스(`ExecutionEngineService`)를 직접 호출합니다. 게이트웨이는 메시지를 수신하여 적절한 애플리케이션 서비스로 라우팅하는 역할만 해야 합니다. 현재 구조에서는 `WebsocketModule`이 `ExecutionEngineModule`을 알아야 하므로 앞서 언급한 순환 의존성의 직접적 원인이 됩니다.
- 제안: `WebsocketGateway`는 `FormSubmissionHandler`나 `ExecutionCommandService` 같은 중간 서비스를 참조하고, 해당 서비스가 `ExecutionEngineService`를 호출하도록 레이어를 추가하세요.

---

**[WARNING] 폼 제출 채널 이중화 — REST + WebSocket 동시 지원**
- 위치: `executions.controller.ts:40~49` (`POST /:id/continue`) + `websocket.gateway.ts:156` (`execution.submit_form`)
- 상세: 동일한 `continueExecution` 동작이 두 채널로 노출됩니다. 이중화 자체는 의도적일 수 있으나, 인증/인가 처리가 두 경로에서 일관성 있게 적용되는지 확인이 필요합니다. REST 엔드포인트에는 `@UseGuards(JwtAuthGuard)` 등이 있지만, WebSocket 핸들러는 `@Public()` 데코레이터로 클래스 전체가 인증 우회됩니다. 폼 제출 핸들러가 클라이언트 인증 없이 호출 가능한 상태입니다.
- 제안: `handleSubmitForm`에서 `client.userId`가 있는지 (즉, `handleConnection`에서 인증된 소켓인지) 검사하는 로직을 추가하거나, `ConnectedSocket`에서 인증 상태를 확인하세요.

---

**[WARNING] `waitingFormConfig`의 타입이 `unknown`**
- 위치: `execution-store.ts:40`, `use-execution-events.ts` 전반
- 상세: `waitingFormConfig: unknown` 타입은 소비 측에서 매번 타입 단언(`as Record<string, unknown>`)이 필요합니다. 폼 설정 구조가 스펙에 정의되어 있으므로 인터페이스를 공유 타입으로 정의할 수 있습니다.
- 제안: 공유 타입 파일에 `FormConfig` 인터페이스를 정의하고 프론트엔드/백엔드 간 스키마를 명시적으로 관리하세요.

---

**[INFO] `handleNodeCompleted`와 `handleNodeEvent("completed")`의 분기 처리**
- 위치: `use-execution-events.ts:123~159`
- 상세: `execution.node.completed` 이벤트 핸들러를 별도로 분리한 것은 합리적입니다. 다만 WebSocket 경로(handleNodeCompleted)와 폴링 경로(pollExecutionStatus 내 로직)에 중복된 프레젠테이션 타입 판별 로직이 존재합니다. `PRESENTATION_TYPES` Set은 공유되지만 결과 추출 로직이 두 곳에 분산되어 있습니다.
- 제안: `extractPresentationResult(ne: NodeExecutionData): NodeResult | null` 같은 순수 함수로 공통 로직을 추출하면 중복이 제거됩니다.

---

**[INFO] `run-results-drawer.tsx` 파일 크기 (600+ 라인)**
- 위치: `run-results-drawer.tsx` 전체
- 상세: 단일 파일에 다수의 렌더러(`TableContent`, `ChartContent`, `CarouselContent` 등), 동적 폼 UI, 히스토리 항목, 메인 드로어 컴포넌트가 모두 정의되어 있습니다. 현재 기능 범위에서는 허용 가능하나, 각 렌더러를 `renderers/` 하위 디렉토리로 분리하면 유지보수성이 향상됩니다.
- 제안: 급하지 않지만 `renderers/table.tsx`, `renderers/form.tsx` 등으로 분리 검토하세요.

---

### 요약

이번 변경은 Form 노드의 실행 일시정지/재개 기능을 구현하는 합리적인 접근이나, 핵심 아키텍처 문제는 `ExecutionEngineModule`과 `WebsocketModule` 사이의 순환 의존성입니다. `forwardRef`로 컴파일 오류는 해소되었지만 설계 상 양 모듈이 서로를 알아야 하는 구조는 향후 테스트 복잡도와 초기화 순서 버그의 잠재적 원인입니다. 추가로 `ExecutionsController`가 `ExecutionEngineService`를 직접 참조하여 레이어 경계를 침범하고, `WebsocketGateway`가 도메인 서비스를 직접 오케스트레이션하는 두 가지 레이어 책임 위반도 존재합니다. 인메모리 `pendingContinuations`는 단일 인스턴스 한계가 있으나 현재 스펙 범위에서는 수용 가능합니다. 가장 시급한 개선은 이벤트 기반 분리를 통한 순환 의존성 해소와, `ExecutionEngineService` 직접 참조를 `ExecutionsService` 위임으로 교체하는 것입니다.

### 위험도

**HIGH**