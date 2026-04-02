### 발견사항

---

**[CRITICAL] 순환 의존성 (Circular Dependency)**
- 위치: `execution-engine.service.ts:101` / `websocket.gateway.ts:44`
- 상세: `ExecutionEngineService` → `WebsocketService`, `WebsocketGateway` → `ExecutionEngineService` 양방향 의존이 `forwardRef`로 해소되어 있음. 하지만 이는 순환 의존 자체를 제거한 것이 아니라 NestJS DI 해결 시점을 늦춘 것에 불과. 실질적 순환 참조가 존재하며, 이는 아키텍처 경계 위반의 명확한 신호.
- 제안: `ExecutionEngineService`에서 `WebsocketService` 직접 주입을 제거하고, NestJS `EventEmitter2` 또는 도메인 이벤트 버스(Observer 패턴)를 도입하여 단방향 의존성을 유지. `ExecutionEngineService`는 이벤트를 emit하고, `WebsocketService`는 이벤트를 구독하여 WS로 전달.

---

**[CRITICAL] 실행 상태를 in-memory Map으로 관리 (scalability 위험)**
- 위치: `execution-engine.service.ts:82-90` (`pendingContinuations`)
- 상세: Form 대기 상태를 `ExecutionEngineService` 인스턴스의 로컬 Map에 보관. 단일 서버에서만 동작하며, 서버 재시작 시 모든 대기 중 실행이 응답 불가 상태로 고아(orphan)가 됨. 수평 확장(multi-instance) 시 다른 인스턴스에서 `continueExecution` 요청이 들어오면 continuation을 찾지 못함.
- 제안: 재시작 안전성을 위해 최소한 서버 시작 시 DB에서 `WAITING_FOR_INPUT` 상태의 실행을 감지하여 오류 처리하는 복구 로직 필요. 장기적으로는 Redis 기반 분산 continuation 또는 이벤트 소싱 방식 고려.

---

**[WARNING] SRP 위반 — ExecutionEngineService의 책임 과부하**
- 위치: `execution-engine.service.ts` 전체
- 상세: 현재 서비스가 (1) 실행 오케스트레이션, (2) Form 중단/재개 상태 관리, (3) 노드별 실행 결과 저장, (4) WebSocket 이벤트 발행, (5) 재시도 로직을 단일 클래스에서 모두 처리. `waitForFormSubmission`이 추가되면서 책임이 더욱 증가.
- 제안: `FormContinuationService`(대기/재개 로직 전담)를 별도 서비스로 분리하고, `ExecutionEngineService`는 이를 주입받아 사용. WS 이벤트 발행은 이벤트 버스 도입으로 분리.

---

**[WARNING] WebsocketGateway의 비즈니스 로직 직접 호출**
- 위치: `websocket.gateway.ts:156-181` (`handleSubmitForm`)
- 상세: Gateway 레이어(전송/연결 계층)가 `ExecutionEngineService`의 비즈니스 메서드(`continueExecution`)를 직접 호출. Gateway는 메시지 라우팅만 담당해야 하며, 이 구조에서 순환 참조가 발생.
- 제안: Gateway → 별도 `ExecutionCommandService` 또는 이벤트 emit → Engine이 처리하는 방식으로 계층 분리.

---

**[WARNING] `waitForFormSubmission`에 timeout 없음**
- 위치: `execution-engine.service.ts:351-408`
- 상세: Form 대기 Promise에 타임아웃이 없어 사용자가 영구적으로 응답하지 않으면 실행이 무한 대기. Node.js 이벤트 루프가 해당 Promise를 계속 참조하며 메모리 누수 가능성 있음.
- 제안: `Promise.race([formPromise, timeoutPromise])`로 configurable timeout(예: 24h) 적용 후 `ExecutionCancelledError` 처리.

---

**[WARNING] `resumeFromForm`이 낙관적 상태 전환 (비동기 결과 미반영)**
- 위치: `execution-store.ts:108-113` / `run-results-drawer.tsx:handleFormSubmit`
- 상세: 폼 제출 시 WS emit 후 즉시 store를 `running` 상태로 전환(`resumeFromForm`). 그러나 `continueExecution` 성공/실패 응답(`execution.form_submitted`)을 확인하지 않음. 서버에서 에러가 반환되더라도 UI는 이미 running 상태.
- 제안: WS ack 응답(`execution.form_submitted`) 수신 후 상태 전환하거나, 실패 시 에러 상태로 복귀하는 핸들러 필요.

---

**[WARNING] `dangerouslySetInnerHTML` XSS 위험**
- 위치: `run-results-drawer.tsx:ChartContent`, `TemplateContent`
- 상세: 서버에서 내려온 `data.rendered` HTML을 sanitize 없이 직접 렌더링. 워크플로우 내 악의적 데이터가 있을 경우 XSS 가능성.
- 제안: `DOMPurify` 등으로 HTML sanitize 후 렌더링.

---

**[INFO] `handleNodeCompleted`와 polling의 중복 presentation 결과 수집 로직**
- 위치: `use-execution-events.ts:123-158` vs `use-execution-events.ts:210-231`
- 상세: WebSocket `handleNodeCompleted`와 polling 루프 양쪽에 presentation node 결과 수집 로직이 중복. store의 `addNodeResult`에서 중복 방지 처리가 있어 동작은 정상이지만, 로직 자체가 두 곳에 분산.
- 제안: `collectPresentationResult(ne)` 유틸 함수로 추출하여 단일 지점에서 관리.

---

**[INFO] `ExecutionCancelledError`가 파일 내부에만 존재**
- 위치: `execution-engine.service.ts:63-68`
- 상세: 도메인 에러 클래스가 서비스 파일 내 클래스로 선언되어 외부에서 타입 참조 불가. 향후 테스트나 다른 서비스에서 이 에러를 구분해야 할 때 문제.
- 제안: `errors/` 디렉토리에 별도 파일로 export.

---

### 요약

이번 변경은 Form 노드의 사용자 입력 대기 기능을 구현하기 위해 `ExecutionEngineService`에 중단/재개 메커니즘, `WebsocketGateway`에 폼 제출 핸들러, 프론트엔드에 상태 관리 및 UI를 추가했다. 기능 구현 의도는 명확하나 핵심 아키텍처 문제가 두 가지 존재한다: 첫째, `ExecutionEngineService`↔`WebsocketGateway` 간 `forwardRef`로 감춰진 실질적 순환 의존성이 레이어 경계를 무너뜨리고 있으며, 둘째, Form 대기 상태를 in-memory Map으로 관리함으로써 단일 인스턴스 의존과 재시작 취약성이 내재되었다. 두 문제 모두 이벤트 버스(도메인 이벤트) 도입과 `FormContinuationService` 분리로 함께 해결할 수 있으며, 이 작업 없이 기능이 확장되면 결합도 문제가 점점 심화될 것이다.

### 위험도
**HIGH**