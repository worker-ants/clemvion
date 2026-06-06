# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [INFO] reconcilePreParkWaitingStatus — pure function 전환 완료, 원본 엔티티 변이 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` 함수 (diff L230–244)
- 상세: 이번 diff 에서 `reconcilePreParkWaitingStatus` 는 `NodeExecution[]` 를 받아 `{ ...ne, status: NodeExecutionStatus.WAITING_FOR_INPUT }` spread 방식으로 새 plain 객체를 반환하는 `map` 배열을 돌려준다. 원본 TypeORM 엔티티를 in-place 변이하지 않는다. 반환값이 `reconciledNodeExecutions` 에 별도 할당된 뒤 스냅샷 응답에 사용된다(L253–263). 이전 리뷰(13_57_06 SUMMARY W4)에서 경고됐던 in-place mutation 이 이 diff 에서 이미 수정되어 있다. DB write 는 발생하지 않으며 TypeORM identity map 을 통한 상태 전파 위험도 제거되었다.
- 제안: 해당 없음. 이미 올바르게 구현됨.

### [INFO] snapshotCache 에 저장되는 참조 — spread 객체이므로 캐시 오염 위험 제거
- 위치: `executions.service.ts` — `findById` 내 `reconciledNodeExecutions` 사용 경로
- 상세: `reconcilePreParkWaitingStatus` 가 `{ ...ne, status }` 로 새 plain 객체를 반환하므로, 캐시에 저장되는 `nodeExecutions` 배열의 요소는 TypeORM 엔티티 인스턴스가 아닌 plain 객체다. 원본 엔티티가 이후 다른 코드 경로에서 변이되거나 ORM flush 가 발생해도 캐시 내 값은 독립적으로 보존된다. 다만 spread 는 shallow copy 이므로 `outputData` 등 중첩 객체는 원본과 참조를 공유한다. 현재 코드에서 `outputData` 를 캐시 후 변이하는 경로는 없으며 실질 위험은 없다.
- 제안: 필요 시 `outputData` deep clone 을 추가할 수 있으나, 현재 호출 구조상 불필요.

### [INFO] NodeExecutionStatus import 추가 — 기존 인터페이스/시그니처 변경 없음
- 위치: `executions.service.ts` diff L182–189
- 상세: `NodeExecutionStatus` enum 을 추가 import 했다. 기존 public API, 함수 시그니처, 환경 변수, 네트워크 호출에 영향을 주지 않는다.
- 제안: 해당 없음.

### [INFO] isNodeWaitingForInput 신규 export — 공개 API 영향 미미
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` — `isNodeWaitingForInput` 함수 export
- 상세: `isNodeWaitingForInput` 이 `export` 로 공개되었다. 이 파일 하단의 "Internal helpers (also used by use-execution-events.ts)" 주석처럼 동일 패키지 내 `use-execution-events.ts` 에서도 사용하기 위한 의도다. 기존 소비자 코드가 없는 신규 export 이므로 기존 호출자에 미치는 영향은 없다. 단, 공개 API 노출 범위가 넓어지는 구조 변화로, 향후 소비자가 늘어날 경우 함수 의미 변경 시 영향 범위가 확대될 수 있다.
- 제안: 배럴(`index.ts`)이 있다면 이 함수를 re-export 에서 제외해 폴더 내부 공유용임을 명시하면 캡슐화가 강화된다.

### [INFO] applyExecutionSnapshot 내 waiting-node 판정 로직 교체 — 기존 동작과 의미 확장
- 위치: `apply-execution-snapshot.ts` diff L371–397
- 상세: `ne.status === 'waiting_for_input'` 단일 비교를 `isNodeWaitingForInput(ne)` 호출로 교체했다. `isNodeWaitingForInput` 은 `ne.status === 'waiting_for_input'` 외에 `ne.status === 'running' || 'pending'` 이면서 `outputData.status === 'waiting_for_input'` 인 케이스도 `true` 를 반환한다. 이는 기능 확장이자 의도된 fix 이지만, 해당 함수가 사용되는 세 위치(reconcileToWaiting 판정 L126, hasWaitingNode 판정 L152, waitingNode 탐색 L186) 모두에서 동일하게 교체되어 일관성이 있다. 이전에는 `ne.status` 만 보던 곳에서 이제 `outputData.status` 봉투도 함께 본다는 의미에서 판정 조건이 확장되었고, terminal 노드(completed/failed/skipped/cancelled)는 명시적으로 제외한다.
- 제안: 해당 없음. 의도된 동작.

### [INFO] e2e 파일 변경 — 순수 포맷팅, 부작용 없음
- 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts`
- 상세: diff 내용은 긴 줄을 여러 줄로 분리한 코드 스타일 조정이 전부다. 로직·assertion·setup/teardown 변경 없음. 네트워크 호출, 환경 변수, 파일시스템 접근에 영향을 주지 않는다.
- 제안: 해당 없음.

### [INFO] 테스트 파일 mock 격리 — 프로덕션 상태에 부작용 없음
- 위치: `executions.service.spec.ts` — 추가된 테스트 케이스 (diff L36–163)
- 상세: 신규 테스트 케이스 4개 모두 `mockReturnValueOnce` 패턴을 사용한다. jest mock 을 통해 `executionRepo`, `nodeExecutionRepo`, `executionNodeLogRepo` 를 격리하며, 실제 DB·네트워크·파일시스템을 접촉하지 않는다. `beforeEach` 에서 전체 mock 이 재생성되므로 테스트 간 상태 오염이 없다.
- 제안: 해당 없음.

### [INFO] use-widget-eager-start.test.ts 변경 — 테스트 단언 순서 교정, 부작용 없음
- 위치: `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts`
- 상세: `waitFor(callCount===2)` 이후 `executionId` 를 단언하는 순서에서 `waitFor(executionId==="e2")` 이후 `callCount` 를 단언하는 순서로 교체했다. React state commit race 를 제거한 올바른 수정이다. 프로덕션 코드·공유 상태·외부 리소스에 영향 없다.
- 제안: 해당 없음.

---

## 요약

이번 변경의 핵심인 `reconcilePreParkWaitingStatus`(backend)와 `isNodeWaitingForInput`(frontend) 은 모두 read-only 정규화로, DB write 가 없고 TypeORM 엔티티를 in-place 변이하지 않는다. 이전 리뷰(13_57_06)에서 WARNING 으로 지적된 in-place mutation(W4)이 이 diff 에서 이미 pure function 전환(`{ ...ne, status }` spread + 새 배열 반환)으로 수정되어 있어 캐시 참조 오염 위험이 제거되었다. 전역 변수 수정, 신규 환경 변수, 의도하지 않은 네트워크 호출, 파일시스템 부작용, 이벤트/콜백 변경은 없다. `isNodeWaitingForInput` 의 신규 export 는 기존 호출자 없는 새 공개 API 이므로 Breaking Change 가 없다. `applyExecutionSnapshot` 내 waiting 판정 확장은 의도된 행동 변경이며 terminal 노드 방어가 명확히 구현되어 있다. 부작용 관점에서 이번 변경은 안전하다.

---

## 위험도

LOW

STATUS: SUCCESS
