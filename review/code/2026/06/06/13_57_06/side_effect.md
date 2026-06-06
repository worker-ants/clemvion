# 부작용(Side Effect) Review

## 발견사항

### [WARNING] reconcilePreParkWaitingStatus 가 입력 배열 요소를 in-place 변이시킴
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` 함수 (라인 743–754 기준 diff, 전체 파일 877–888)
- 상세: 함수가 `NodeExecution[]` 배열의 각 요소를 `ne.status = NodeExecutionStatus.WAITING_FOR_INPUT` 로 직접 변이한다. 해당 객체는 TypeORM 이 트랜잭션 `manager.find(NodeExecution, ...)` 로 반환한 엔티티 인스턴스다. TypeORM 의 identity map(Unit of Work) 이 활성화된 경우, 동일 트랜잭션 또는 동일 EntityManager scope 에서 같은 row 의 참조가 공유되면 변이된 status 가 **flush/save 없이도 동일 인스턴스를 참조하는 다른 코드 경로에 노출**될 수 있다. 현재 코드에서는 해당 트랜잭션 scope 가 `findById` 내부로 한정되며 save 를 호출하지 않으므로 DB write 는 발생하지 않는다. 그러나 `snapshotCache` 에 저장된 `ExecutionDetailWithTrigger.nodeExecutions` 배열에 변이된 엔티티가 그대로 담기므로, 추후 다른 코드가 캐시 객체를 참조·재변이할 경우 예상 외의 상태 전파 위험이 있다.
- 제안: 변이 대신 새 plain object 를 반환하는 방식으로 변경하거나, 최소한 함수 명칭을 `mutatePreParkWaitingStatus` 로 명시해 변이 의도를 드러내는 것이 바람직하다. 또는 `ne.status` 를 직접 수정하는 대신 `{ ...ne, status: NodeExecutionStatus.WAITING_FOR_INPUT }` 형태로 매핑하면 원본 엔티티가 오염되지 않는다.

### [INFO] snapshotCache 에 변이된 엔티티 참조가 저장됨
- 위치: `executions.service.ts` — `writeSnapshotCache` 호출 직전 `reconcilePreParkWaitingStatus(nodeExecutions)` (라인 763 diff 기준)
- 상세: `reconcilePreParkWaitingStatus` 가 in-place 변이 후 캐시에 저장되는 snapshot 은 변이된 상태를 영구적으로 보존한다. 이 자체는 의도된 동작(snapshot read-side normalization)이나, 캐시 히트 경로에서 동일 객체 참조가 반환되므로 호출자가 반환값을 변이하면 캐시 내용도 변이된다. 현재 호출자 구조상 문제가 없으나 참조 공유로 인한 잠재적 위험이다.
- 제안: 캐시 저장 전 `Object.freeze` 또는 deep clone 을 적용해 캐시 오염을 방지할 것을 고려.

### [INFO] NodeExecutionStatus import 추가 — 기존 인터페이스/시그니처 변경 없음
- 위치: `executions.service.ts` diff 라인 9–11
- 상세: `NodeExecutionStatus` enum 을 추가로 import 한 것으로, 기존 public API·함수 시그니처·환경 변수·네트워크 호출에 영향을 주지 않는다.

### [INFO] e2e 파일 변경은 순수 포맷팅(줄 바꿈)
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts` diff
- 상세: 변경 내용 전체가 긴 줄을 여러 줄로 나누는 코드 스타일 포맷팅이다. 로직·assertion·setup/teardown 변경 없음. 부작용 없음.

### [INFO] 테스트 파일은 프로덕션 상태에 부작용 없음
- 위치: `executions.service.spec.ts` — 추가된 두 테스트 케이스
- 상세: jest mock 을 통해 `executionRepo`, `nodeExecutionRepo`, `executionNodeLogRepo` 를 격리하며, 실제 DB·네트워크·파일시스템을 접촉하지 않는다. `mockReturnValue` (not once) 를 사용하므로 해당 테스트 케이스 이후의 mock 상태가 다음 테스트에 누출될 수 있으나, `beforeEach` 에서 전체 mock 을 재생성하므로 격리가 보장된다.

## 요약

이번 변경의 핵심은 `reconcilePreParkWaitingStatus` 함수 도입으로, `findById` 트랜잭션 내에서 `running` 상태 `NodeExecution` 의 `status` 를 `outputData.status === 'waiting_for_input'` 조건에 따라 in-place 변이한다. DB write 는 전혀 발생하지 않아 영속 레이어에는 부작용이 없으나, TypeORM 엔티티를 직접 변이하고 그 참조를 LRU 캐시에 저장한다는 점이 WARNING 수준의 잠재적 상태 오염 경로를 만든다. 현재 실제 호출 흐름에서 구체적인 문제가 발현되지는 않으나 함수가 in-place mutation 임을 명시하거나 immutable 매핑으로 전환하면 위험이 제거된다. e2e 파일과 spec 파일 변경은 포맷팅 및 테스트 추가에 한정되어 부작용이 없다.

## 위험도

LOW
