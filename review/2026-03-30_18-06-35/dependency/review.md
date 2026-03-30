### 발견사항

- **[INFO]** `WorkflowsModule`이 `ExecutionEngineModule`을 import하여 Controller에서 `ExecutionEngineService`를 사용
  - 위치: `workflows.module.ts`
  - 상세: `WorkflowsModule → ExecutionEngineModule → WebsocketModule` 체인이 형성됨. 순환 의존성 위험은 없으나 모듈 간 결합도가 증가함
  - 제안: 현재 구조는 허용 가능하나, 향후 `ExecutionModule`을 별도 분리하는 것을 고려

- **[INFO]** `WorkflowsService`가 직접 `Node`, `Edge` Repository와 `DataSource`를 주입받음
  - 위치: `workflows.service.ts:15-19`
  - 상세: Canvas 저장 로직이 `WorkflowsService`에 포함되어 책임이 분산됨. `Node`와 `Edge`는 원래 각자의 모듈(`NodesModule`, `EdgesModule`)이 담당해야 함
  - 제안: 허용 가능한 수준이나, 캔버스 저장 전용 서비스를 별도 분리하면 모듈 경계가 명확해짐

- **[INFO]** `ExecutionEngineService`가 `WebsocketService`를 직접 주입받음
  - 위치: `execution-engine.service.ts:75`
  - 상세: 실행 엔진이 WebSocket 전송에 직접 의존하는 구조. 향후 다른 전송 방식(SSE 등) 추가 시 변경 필요
  - 제안: 현 Phase에서는 수용 가능. 장기적으로는 이벤트 버스(EventEmitter2) 패턴 고려

- **[INFO]** `frontend/src/lib/stores/editor-store.ts`에서 store 내부에 `workflowsApi` 직접 import
  - 위치: `editor-store.ts:4`
  - 상세: Zustand store가 API 레이어에 직접 의존. 테스트 시 API mocking이 필요하며 store 순수성이 낮아짐
  - 제안: `saveWorkflow`를 store 외부(컴포넌트/훅)에서 호출하거나, API를 주입받는 패턴 고려

- **[INFO]** `backend/.next/` 경로가 git에 추적되고 있음
  - 위치: `backend/.next/trace`, `backend/.next/trace-build`
  - 상세: Next.js 빌드 아티팩트가 버전 관리되고 있으며, 빌드 실패(`"failed":true`) 흔적도 포함됨. `backend`에 Next.js 빌드가 존재하는 것도 구조적으로 이상함 (백엔드는 NestJS)
  - 제안: `.gitignore`에 `backend/.next/` 추가 필요. **즉시 조치 권장**

- **[INFO]** `SaveCanvasNodeDto`의 `id` 필드에 `@IsUUID()` 대신 `@IsString()` + `@MaxLength(36)` 사용
  - 위치: `save-canvas.dto.ts:18-20`
  - 상세: 클라이언트에서 `crypto.randomUUID()`로 UUID를 생성하므로 `@IsUUID()` 검증이 더 명확함
  - 제안: `@IsUUID('4')` 로 변경하여 형식 검증 강화

- **[INFO]** `useExecutionStore`가 `custom-node.tsx`와 `editor-toolbar.tsx`, `workflow-editor.tsx` 등 다수 컴포넌트에서 직접 import됨
  - 위치: 프론트엔드 전반
  - 상세: 새로운 외부 패키지 추가 없이 기존 `zustand` 의존성 내에서 처리됨. 의존성 추가 문제 없음
  - 제안: 없음 (적절한 패턴)

---

### 요약

이번 변경에서 **새로운 외부 npm 패키지는 추가되지 않았으며**, 기존 의존성(NestJS, TypeORM, Zustand, React Flow) 범위 내에서 내부 모듈 간 의존 관계만 재편되었다. 주목할 점은 `backend/.next/` 빌드 아티팩트가 git에 추적되고 있다는 것으로, 즉시 `.gitignore`에 추가해야 한다. 모듈 간 결합도는 다소 증가했으나(WorkflowsModule → ExecutionEngineModule → WebsocketModule) 순환 의존성은 없으며, 현 Phase 수준에서는 수용 가능한 설계다. `WorkflowsService`가 Node/Edge Repository를 직접 관리하는 점은 향후 리팩토링 대상이다.

### 위험도

**LOW**