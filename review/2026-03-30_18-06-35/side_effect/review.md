## 부작용 코드 리뷰 결과

### 발견사항

---

**[WARNING]** `saveCanvas`에서 엣지 전체 삭제 후 재생성 — 동시 요청 시 데이터 손실 위험
- 위치: `workflows.service.ts` `saveCanvas()` — 엣지 sync 로직
- 상세: 트랜잭션 내에서 기존 엣지를 전부 `remove` 후 재삽입하는 방식이다. 트랜잭션으로 보호되므로 일반 케이스는 안전하나, 동시에 두 클라이언트가 같은 워크플로우를 저장할 경우 서로의 변경이 충돌할 수 있다. 노드와 달리 엣지에는 upsert 전략이 없어 항상 전체 교체된다.
- 제안: 낙관적 락(버전 필드 체크) 또는 Last-Write-Wins 정책을 명시적으로 문서화. `currentVersion` 증가를 조건부 UPDATE(`WHERE version = :expected`)로 처리해 충돌 감지 가능.

---

**[WARNING]** `create()` 워크플로우 생성 시 트리거 노드 생성 — 트랜잭션 외부 실행
- 위치: `workflows.service.ts` `create()` L91-L104
- 상세: `workflowRepository.save(workflow)` 성공 후 별도로 `nodeRepository.save(triggerNode)`를 호출한다. 두 작업이 동일 트랜잭션으로 묶이지 않아, 워크플로우는 생성되었으나 트리거 노드 저장이 실패하면 불완전한 상태(트리거 없는 워크플로우)가 DB에 남는다.
- 제안: `dataSource.transaction()`으로 묶거나, 적어도 실패 시 워크플로우도 롤백하는 보상 로직 추가.

---

**[WARNING]** `ExecutionEngineService.execute()` — `EXECUTION_STARTED` 이벤트 발행 후 실패해도 `EXECUTION_FAILED` 중복 발행 가능
- 위치: `execution-engine.service.ts` L146-L151, L255-L264
- 상세: `RUNNING` 상태 전환 직후 WebSocket 이벤트를 발행한다. 이후 노드 로딩 등에서 예외가 발생하면 catch 블록에서 `EXECUTION_FAILED`도 발행된다. 클라이언트 입장에서는 `STARTED` → `FAILED` 순서로 이벤트를 수신하는데, 중간에 `COMPLETED` 없이 `FAILED`가 오는 케이스가 정상 동작이지만 클라이언트가 이를 올바르게 처리하는지 확인 필요.
- 제안: 현재 구조상 의도된 동작이므로 클라이언트 `execution-store`의 상태 머신에서 `started → failed` 전환을 명시적으로 허용하는지 확인.

---

**[WARNING]** `WorkflowsController.execute()` — workspace 소속 확인 후 실행엔진 호출 사이 TOCTOU
- 위치: `workflows.controller.ts` `execute()` L81-L95
- 상세: `findById()`로 권한을 확인한 뒤 별도 호출로 `executionEngineService.execute()`를 실행한다. 두 호출 사이에 워크플로우가 다른 workspace로 이전되거나 삭제될 수 있다(이론적). 실제 문제 가능성은 낮지만 실행 엔진 내부에서도 `workflowId`만으로 workflow를 로딩하므로 workspace 소속 재검증이 없다.
- 제안: `executionEngineService.execute()`에 `workspaceId`를 전달하거나, 실행 엔진 내부에서 workspace 소속을 재확인.

---

**[INFO]** `NodeCategory` enum에 `TRIGGER` 추가 — DB 마이그레이션 필요
- 위치: `node.entity.ts` L14
- 상세: TypeORM enum 컬럼에 새 값 `'trigger'`가 추가되었다. PostgreSQL의 경우 `ALTER TYPE ... ADD VALUE` 마이그레이션이 필요하다. 마이그레이션 없이 배포하면 기존 DB에서 `category = 'trigger'` INSERT 시 constraint violation 발생.
- 제안: 마이그레이션 파일 생성 여부 확인. `synchronize: true` 옵션이 비활성화된 프로덕션 환경에서는 반드시 수동 마이그레이션 필요.

---

**[INFO]** `WorkflowsModule`이 `ExecutionEngineModule`을 import — 순환 의존성 잠재 가능성
- 위치: `workflows.module.ts` L10
- 상세: `ExecutionEngineModule`은 내부적으로 많은 서비스를 포함한다. `WorkflowsModule`에서 `ExecutionEngineModule`을 import하고, 미래에 `ExecutionEngineModule`이 `WorkflowsModule`의 서비스를 역참조하면 순환 의존성이 발생한다.
- 제안: 현재는 문제없으나, 향후 실행 엔진에서 워크플로우 서비스를 직접 참조하는 경우 `forwardRef()` 또는 별도 공유 모듈로 분리 고려.

---

**[INFO]** `saveWorkflow()`의 에러 처리 — 저장 실패가 조용히 묻힘
- 위치: `editor-store.ts` `saveWorkflow()` L130-L134
- 상세: `catch (error) { console.error(...) }`로만 처리되어 저장 실패 시 사용자에게 알림이 없다. `isDirty`도 `true`로 유지되므로 데이터 유실은 없지만, 사용자가 실패를 인지하지 못한 채 계속 작업할 수 있다.
- 제안: 에러 발생 시 toast 알림 또는 에러 상태를 store에 노출해 UI에서 표시.

---

**[INFO]** `handleRun()`에서 저장 실패 시에도 실행 진행
- 위치: `editor-toolbar.tsx` `handleRun()` L38-L42
- 상세: `isDirty`일 때 `await saveWorkflow()`를 호출하지만, `saveWorkflow`가 내부에서 에러를 catch하고 반환하므로 저장 실패 여부를 `handleRun`이 알 수 없다. 저장 실패 후에도 이전 버전으로 실행이 진행된다.
- 제안: `saveWorkflow`가 성공/실패를 boolean으로 반환하거나 예외를 던지도록 수정, `handleRun`에서 저장 실패 시 실행 중단.

---

### 요약

전체적으로 의도하지 않은 전역 상태 오염이나 파일시스템/환경변수 부작용은 없다. 주요 위험은 두 곳의 **비원자적 쓰기 작업**이다: (1) 워크플로우 생성 시 트리거 노드를 트랜잭션 밖에서 생성하는 패턴은 부분 실패 시 DB 불일치를 야기하며, (2) `saveCanvas`의 엣지 전체 교체 전략은 동시 편집 시 충돌이 가능하다. WebSocket 이벤트 발행은 실행 상태 변경에 잘 연결되어 있으나, 클라이언트 에러 처리가 묵시적으로 처리되는 부분이 개선 여지가 있다. `NodeCategory` enum 확장은 DB 마이그레이션을 반드시 수반해야 한다.

### 위험도

**MEDIUM**