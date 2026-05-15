## 아키텍처 코드 리뷰

### 발견사항

---

**[WARNING] WorkflowsController가 ExecutionEngineService를 직접 의존**
- 위치: `workflows.controller.ts:23`, `workflows.module.ts`
- 상세: `WorkflowsController`가 `ExecutionEngineService`를 직접 주입받아 실행을 처리하고 있습니다. Workflow 도메인 컨트롤러가 ExecutionEngine 도메인 서비스에 직접 의존하는 것은 레이어 경계 침범입니다. `WorkflowsService`가 실행 오케스트레이션을 담당하거나, 별도의 `ExecutionController`를 두는 것이 바람직합니다.
- 제안: `POST /workflows/:id/execute` 엔드포인트를 별도 `ExecutionsController`로 분리하거나, `WorkflowsService`에 `executeWorkflow()` 메서드를 추가해 컨트롤러는 서비스만 호출하도록 위임

---

**[WARNING] ExecutionEngineService에 WebSocket 이벤트 발행 직접 결합**
- 위치: `execution-engine.service.ts:146, 223, 255, 282` 등
- 상세: 실행 엔진 핵심 로직에 WebSocket 이벤트 발행이 직접 인라인으로 혼재되어 있습니다. SRP 위반으로, 실행 엔진이 "실행 수행"과 "실행 상태 브로드캐스트" 두 가지 책임을 갖습니다. 이벤트 발행 방식이 변경될 때(예: WebSocket → SSE 전환) 엔진 코드를 수정해야 합니다.
- 제안: NestJS `EventEmitter2` 또는 도메인 이벤트 패턴을 사용해 `ExecutionEngine`은 이벤트를 emit하고, 별도 `ExecutionEventListener`가 WebSocket 발행을 처리하는 구조로 분리

---

**[WARNING] WorkflowsService에 Node/Edge 저장 책임 혼입**
- 위치: `workflows.service.ts:91-112, 157-253`
- 상세: `WorkflowsService`가 워크플로우 메타데이터 관리 외에 Node/Edge의 전체 CRUD(saveCanvas)까지 담당하고 있습니다. 서비스가 `nodeRepository`, `edgeRepository`, `DataSource`를 모두 주입받아 응집도가 낮아졌습니다. 특히 `saveCanvas`의 트랜잭션 로직(200+ 라인)은 별도 서비스로 분리할 규모입니다.
- 제안: `CanvasService` 또는 `NodeEdgeSyncService`를 별도 생성해 캔버스 저장 로직 분리

---

**[INFO] ExecutionEngineModule이 WebsocketModule에 단방향 의존**
- 위치: `execution-engine.module.ts`
- 상세: 현재 구조는 `ExecutionEngineModule → WebsocketModule`로 단방향 의존이 성립해 순환 참조는 없습니다. 다만 위의 WARNING에서 제안한 이벤트 패턴으로 리팩토링 시 이 의존성 자체가 제거되어 모듈 경계가 더 명확해집니다.
- 제안: 현 상태 유지 가능하나, 이벤트 기반 분리 권장

---

**[INFO] saveCanvas에서 엣지는 전량 삭제 후 재생성, 노드는 upsert — 비대칭 전략**
- 위치: `workflows.service.ts:210-252`
- 상세: 노드는 기존 레코드를 find → 비교 → upsert하지만, 엣지는 모두 삭제 후 재생성합니다. 이 비대칭 전략은 엣지 ID가 매번 새로 생성되어 클라이언트가 저장 전후 엣지 ID를 신뢰할 수 없게 만듭니다. 또한 `SaveCanvasEdgeDto`에 `id` 필드가 있음에도 저장 시 무시됩니다.
- 제안: 노드와 동일하게 엣지도 upsert 전략 적용, 혹은 엣지 ID를 클라이언트에서 UUID로 관리하고 서버에서 보존

---

**[INFO] editor-store.ts에서 API 직접 호출**
- 위치: `editor-store.ts:111-149`
- 상세: Zustand store가 `workflowsApi`를 직접 임포트하고 호출합니다. 상태 관리 계층이 API 통신 책임까지 갖는 것으로, 테스트 격리와 관심사 분리 측면에서 아쉽습니다. React Query/SWR 패턴이나 커스텀 훅으로 분리하는 것이 더 명확한 레이어 경계를 만듭니다. 현재 프로젝트 규모에서는 허용 범위이나 확장 시 문제가 될 수 있습니다.
- 제안: 저장 로직을 `useSaveWorkflow` 훅으로 분리하거나 현 구조 유지 시 주석으로 의도 명시

---

**[INFO] backend/.next/ 디렉토리가 추적됨**
- 위치: `backend/.next/trace`, `backend/.next/trace-build`
- 상세: Next.js 빌드 아티팩트가 git 추적 대상에 포함되어 있습니다. backend 디렉토리에 Next.js가 있는 것 자체도 구조적으로 의아합니다(NestJS 백엔드에 Next.js 빌드 결과물).
- 제안: `backend/.next/`를 `.gitignore`에 추가

---

### 요약

전반적으로 Manual Trigger 노드 도입과 캔버스 저장/실행 파이프라인 구현은 스펙을 잘 반영하고 있습니다. 다만 두 가지 주요 아키텍처 문제가 있습니다. 첫째, `WorkflowsController`가 `ExecutionEngineService`를 직접 의존해 Workflow와 Execution 두 도메인의 경계가 흐려졌습니다. 둘째, `ExecutionEngineService`에 WebSocket 발행 로직이 직접 인라인으로 혼입되어 SRP를 위반하고 있으며, 향후 알림 채널 변경 시 엔진 핵심 로직을 수정해야 하는 취약한 구조입니다. 이벤트 기반 패턴 도입으로 두 문제를 동시에 해결할 수 있습니다. `WorkflowsService`의 Node/Edge 책임 혼입도 서비스가 커질수록 유지보수 부담이 증가할 수 있어 모니터링이 필요합니다.

### 위험도

**MEDIUM**