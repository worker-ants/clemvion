# 동시성(Concurrency) 리뷰 결과

## 발견사항

이번 변경의 핵심 동기 자체가 동시성 관련 현상(pre-park read-window intra-row inconsistency)에 대한 대응이다. 다만 수정 전략이 DB write 경로가 아닌 **read-side normalization** 이므로, 새로운 동시성 결함이 도입되는지를 중점적으로 분석했다.

### 발견사항 1

- **[INFO]** `reconcilePreParkWaitingStatus` 가 방어하는 pre-park window 자체는 여전히 존재한다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/backend/src/modules/executions/executions.service.ts` — `reconcilePreParkWaitingStatus` 함수
  - 상세: 이 함수는 `executeNode` blocking 분기에서 `outputData` 저장 직후 ~ `waitForXxx` atomic 전이 전 사이에 snapshot 이 읽히는 race window 를 read-side 에서 보정한다. 함수 자체는 순수 read-only 변환(pure function, 변이 없음)이므로 DB write 경쟁 조건이나 새로운 동시성 위험을 도입하지 않는다. window 를 근본적으로 닫으려면 엔진 쪽에서 outputData 저장과 status 전이를 단일 트랜잭션으로 묶어야 하나, 그것은 이번 변경 범위 밖이다.
  - 제안: 현재 전략(read-side normalization)은 부가 동시성 위험이 없다. 다만 pre-park window 를 완전히 제거하려면 `executeNode` blocking 분기의 두 save 를 단일 트랜잭션으로 묶는 후속 작업을 고려한다.

### 발견사항 2

- **[INFO]** `use-widget-eager-start.test.ts` 의 flaky 수정(`callCount` → `executionId` state 대기)은 테스트 레벨의 race 제거이며 운영 코드의 동시성 위험과 무관하다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/fix-carousel-waiting-status-4d4ed3/codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` L288–L342
  - 상세: 기존 `waitFor(() => callCount === 2)` 이후 즉시 `executionId` 를 단언하면, fetch 호출 완료 시점과 React state 반영 시점 사이의 미세 비동기 간극으로 flaky 가 발생했다. `waitFor(() => executionId === 'e2')` 로 교정해 state 커밋까지 대기하는 것은 올바른 async/await 패턴이다. 운영 코드에는 영향이 없다.
  - 제안: 해당 없음. 이미 올바르게 수정됨.

---

## 요약

이번 변경은 blocking 노드의 pre-park read-window에서 발생하는 intra-row inconsistency(`status='running'` + `outputData.status='waiting_for_input'`)를 읽기 측에서 정규화하는 내용이다. `reconcilePreParkWaitingStatus`(backend)와 `isNodeWaitingForInput`(frontend) 모두 순수 읽기 변환이며 DB write·락·공유 가변 상태를 건드리지 않아 새로운 경쟁 조건·데드락·원자성 위반을 도입하지 않는다. async/await 사용도 올바르고 이벤트 루프 블로킹 우려도 없다. 근본 window(outputData 저장 ~ status 전이 사이 read 가능 구간)는 여전히 존재하나 이는 기존 엔진 설계에서 비롯된 것으로 이번 변경 범위 밖이며, read-side normalization 전략이 신규 동시성 위험을 도입하지는 않는다. 테스트의 flaky 수정도 비동기 단언 순서를 올바르게 교정한 것이다.

## 위험도

NONE
