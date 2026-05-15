### 발견사항

- **[WARNING]** `pendingContinuations` Map에 대한 비원자적 체크-삭제-사용 패턴
  - 위치: `execution-engine.service.ts` - `waitForFormSubmission`, `continueExecution`, `cancelWaitingExecution`
  - 상세: `pendingContinuations.has(executionId)` 체크 후 `pendingContinuations.delete(executionId)` 사이에 여러 호출이 들어올 경우 동일한 continuation이 두 번 resolve될 가능성이 있음. 예: 사용자가 폼 제출과 동시에 취소를 누르거나, 타임아웃과 제출이 경합하는 경우.
  - 제안: `continueExecution`, `cancelWaitingExecution`에서 Map에서 꺼낸 값을 즉시 로컬 변수에 저장하고 null-check 후 사용하는 현재 패턴은 단일 스레드(Node.js 이벤트 루프) 내에서는 안전함. 단, setTimeout 콜백에서도 동일 패턴을 사용하므로 이벤트 루프 틱 경계를 인지해야 함.

- **[WARNING]** setTimeout 타임아웃과 외부 `continueExecution` 호출 간의 경합 조건
  - 위치: `waitForFormSubmission` ~L570, `waitForButtonInteraction` ~L650
  - 상세: 타임아웃 콜백에서 `pendingContinuations.has(executionId)` 체크 후 `delete` 및 `reject` 호출 사이에 이벤트 루프 진입이 없으므로 Node.js 단일 스레드 특성상 안전함. 그러나 `continueExecution`이 호출된 직후 동일 틱에서 setTimeout이 실행될 경우 이미 삭제된 Map entry를 체크하므로 안전하게 처리됨. **실질적 위험 낮음.**

- **[WARNING]** `nodeExecutionCount` Map이 back-edge 점프 시 `executedNodes` Set과 상태 불일치 가능성
  - 위치: `execution-engine.service.ts` - `runExecution` 메서드 ~L295
  - 상세: back-edge로 pointer를 되감을 때 `executedNodes`에서 재실행 구간 노드들을 제거하지 않음. 이로 인해 `gatherNodeInput`에서 `executedNodes.has(sourceId)`가 true를 반환하여 이전 사이클의 캐시된 출력을 입력으로 사용함. 이는 설계 의도일 수 있으나, 재실행 구간의 노드가 `executedNodes`에 남아있어 `gatherNodeInput`의 "선행 노드 완료" 판단이 부정확해질 수 있음.
  - 제안: back-edge 점프 시 재실행 구간 노드들을 `executedNodes`에서도 제거할지 여부를 명시적으로 설계 결정으로 문서화하거나, `portRoutingSkipped`처럼 함께 초기화할 것.

- **[INFO]** `runExecution`이 fire-and-forget으로 실행되어 동시 실행 제한이 코드 레벨에서 강제되지 않음
  - 위치: `execute()` 메서드 ~L230
  - 상세: spec의 §8에서 워크스페이스/워크플로우당 동시 실행 제한을 정의하고 있으나, 현재 코드에서는 해당 제한을 강제하는 로직이 없음. 여러 번 `execute()`를 호출하면 동시에 여러 `runExecution`이 동작함.
  - 제안: 동시 실행 제한이 현재 구현 범위 밖이라면 spec과 코드 간 gap을 TODO로 명시할 것.

- **[INFO]** `recoverStuckExecutions`에서 여러 실행을 순차 `await` 저장
  - 위치: `recoverStuckExecutions()` ~L160
  - 상세: 서버 재시작 시 stuck 실행 복구를 순차적으로 처리함. 다수의 stuck 실행이 있을 경우 초기화가 지연될 수 있으나, 운영상 큰 문제는 아님.
  - 제안: `Promise.all(stuck.map(...))` 패턴으로 병렬 처리 고려.

---

### 요약

이 코드는 Node.js 단일 스레드 이벤트 루프 모델 위에서 동작하므로 진정한 의미의 공유 메모리 경합 조건은 발생하지 않는다. `pendingContinuations` Map의 체크-삭제-사용 패턴은 이벤트 루프 틱 경계 내에서 원자적으로 동작하여 실질적 안전성이 확보된다. 가장 주목할 부분은 back-edge 점프 시 `executedNodes` Set의 상태가 정리되지 않아 재실행 구간의 `gatherNodeInput` 동작이 설계 의도와 어긋날 수 있다는 점이며, 이는 기능 정확성에 영향을 줄 수 있는 경계 케이스다. 전반적으로 비동기 await 누락이나 Promise 체인 오류는 없으며, 동시성 관점의 구조적 위험은 낮다.

### 위험도
**LOW**