# 유지보수성(Maintainability) 리뷰

## 발견사항

### continuation-bus.service.spec.ts

- **[INFO]** `fakeRedisInstances` 배열을 모듈 수준 변수로 선언하고 `beforeEach` 에서 `.length = 0` 으로 초기화
  - 위치: 133, 193번 라인
  - 상세: `fakeRedisInstances.length = 0` 은 동작하지만 관용적이지 않다. `fakeRedisInstances.splice(0)` 또는 변수 재선언 패턴이 의도를 더 명확하게 전달한다.
  - 제안: `fakeRedisInstances.length = 0` → `fakeRedisInstances.splice(0)` 또는 `beforeEach` 내에서 별도 지역 변수로 관리.

- **[INFO]** `createFakeRedis` 내 `counter` 변수 네이밍이 단순해 `incr` 카운터인지 범용 카운터인지 불분명
  - 위치: 136번 라인
  - 상세: `counter` 는 범용적인 이름. `incrCounter` 또는 `seqCounter` 로 바꾸면 `incr` mock 의 역할을 즉시 알 수 있다.
  - 제안: `let counter = 0` → `let incrCounter = 0`.

- **[INFO]** describe 제목 "분산 lock (acquireLock / releaseLock)" 과 테스트 케이스 4개 중 마지막 케이스의 주석이 과도하게 길다
  - 위치: 453-463번 라인
  - 상세: 마지막 lock 테스트 케이스에 여러 줄의 인라인 주석이 이어지며 "in-memory store 의 한계로 별 instance 시뮬은 불가" 등 한계를 설명하는데, 이 설명은 테스트 이름이나 상단 describe 블록의 주석으로 이동하면 더 읽기 쉽다.
  - 제안: 테스트 케이스 내부 주석 대신 `describe` 블록 상단에 NOTE 주석 한 줄 추가.

---

### continuation-bus.service.ts

- **[INFO]** `on()` 메서드 파라미터 정렬이 Prettier 적용으로 재포맷됨 (변경 단순 포맷팅)
  - 위치: 541-544번 라인
  - 상세: 기능 변경 없는 포맷팅 전용 diff. 실질적 유지보수성 이슈 없음.

---

### continuation-execution.processor.ts

- **[WARNING]** `applyCancellation` 호출에서 `await` 제거 후 "sync (rejectPending 만 호출) — await 불필요" 주석 추가
  - 위치: 589번 라인
  - 상세: `applyCancellation` 이 현재 sync이지만 향후 async 로 변경될 여지가 있다. `await` 없이 fire-and-forget 하면 에러가 무소음 처리되고, 메서드 시그니처 변경 시 컴파일 경고 없이 회귀가 발생할 수 있다. 주석으로 이유를 달았으나 유지보수성 관점에서 미래 변경 시 오류 유발 가능성이 있다.
  - 제안: `await this.engine.applyCancellation(executionId)` 유지 또는 `void this.engine.applyCancellation(executionId)` 으로 의도 명시. 주석에 "시그니처가 async 로 바뀌면 await 복원 필요" 추가.

---

### execution-engine.service.spec.ts

- **[INFO]** `getPendings` 헬퍼가 `describe` 블록 내부에 정의됐으나 `it` 케이스 정의보다 먼저 위치함
  - 위치: 631-642번 라인
  - 상세: `const getPendings = ...` 가 `it(...)` 블록들 사이에 선언되어 있어 `describe` 블록의 읽기 흐름이 끊긴다. JavaScript 에서 `const` 는 호이스팅되지 않으므로 위치에 따라 참조 에러가 발생할 수 있다. 실제로는 `it` 가 실행될 때 이미 초기화되어 있어 동작하지만, 코드 상단에 두는 것이 관례이다.
  - 제안: `getPendings` 를 `describe` 블록 최상단(첫 번째 `it` 이전)으로 이동.

- **[WARNING]** Phase 2.7 rehydration 통합 테스트가 단일 `it` 블록에 100줄 이상의 setup + assertion을 포함
  - 위치: 960-1093번 라인
  - 상세: mock 재설정, `findOne` 구현 override, 복잡한 체이닝 mock setup, 3회 `flushPromises`, 2개 이상의 assertion 구획을 단일 테스트가 담고 있다. 테스트 실패 시 원인 격리가 어렵고, 특히 `mockNodeExecutionRepo.findOne = jest.fn().mockImplementation(...)` 같은 복잡한 override 패턴은 `afterEach` 복원 로직이 없으면 다른 테스트에 누출 가능성이 있다.
  - 제안: setup 단계를 `beforeEach` 또는 별도 헬퍼 함수로 분리. 검증 구획별로 `describe` 블록을 분리하거나 적어도 검증 단계를 명명된 로컬 함수로 추출.

- **[INFO]** `Rehydration — §7.5 Resume after Restart` describe 블록의 `buildUpdateChain` 이 `beforeEach` 안에 정의되며 매번 재정의됨
  - 위치: 1128-1153번 라인
  - 상세: `buildUpdateChain` 은 순수 팩토리 함수로 `beforeEach` 외부(describe 블록 상단)에 두어도 무방하다. 매 테스트마다 함수 재정의 비용은 무시할 수준이지만, `beforeEach` 가 길어지는 원인.
  - 제안: `buildUpdateChain` 을 `describe` 블록 최상단으로 이동해 `beforeEach` 가독성 향상.

- **[INFO]** `(c[0] as { status?: string; nodeId?: string })?.status` 패턴의 이중 타입 단언이 반복 사용됨
  - 위치: 972-974번 라인
  - 상세: `waitingSave` 를 검색하는 `find` 콜백의 타입 단언이 복잡하다. `getPendings` 와 동일한 이유로 헬퍼로 추출하거나 타입 가드 함수로 대체하면 가독성이 향상된다.
  - 제안: `isWaitingFormSave` 같은 타입 가드 헬퍼 추출.

---

### execution-engine.service.ts

- **[WARNING]** `resumeFromCheckpoint` 메서드가 90줄 이상(분량은 추가 포함 시 더 길어짐)으로 단일 메서드 책임 과다
  - 위치: 1610번 라인 이후
  - 상세: 그래프 재구축, reachability seed, nodeExecutionCount 초기화, resolver fire scheduler 등 여러 관심사를 하나의 메서드가 담고 있다. 순환 복잡도가 높고 테스트에서 "3회 flushPromises" 와 같은 비결정적 패턴이 나타난 것도 이 복잡도와 연관된다.
  - 제안: 그래프 재구축 로직을 `rebuildGraphState(workflowId)` 로, resolver fire 로직을 `scheduleResolverFire(executionId, payload)` 로 분리.

- **[INFO]** `rehydrateContext` 의 `seenNodeIds` Set 과 `executedNodes` Set 이 유사한 역할을 하나 목적이 다름
  - 위치: 1561-1583번 라인
  - 상세: `seenNodeIds` 는 "loop iteration 중복 방지"용, `executedNodes` 는 "context 에 채워지는 완료 노드 목록"으로 목적이 다르다. 현재 코드에서 두 Set 의 차이를 즉시 파악하기 어렵다.
  - 제안: 변수명을 `processedLogNodeIds` 로 변경하거나, 주석에 두 Set 의 차이를 명시.

- **[INFO]** `ContinuationPublishResult` 와 `RehydrationError` 가 같은 파일의 다른 위치에 정의되어 있고 `RehydrationError` 는 파일 내부에서만 사용됨에도 JSDoc 이 매우 상세함
  - 위치: 1314-1342번 라인
  - 상세: `RehydrationError` 의 JSDoc 이 6줄 이상이며, 에러 코드 목록을 열거하는데 코드의 union 타입 리터럴에 이미 코드가 명시되어 있어 중복이다.
  - 제안: JSDoc 을 "각 코드의 의미"만 남기고 코드 목록 중복 제거. 또는 코드 목록은 enum 으로 분리해 JSDoc 이 enum 을 참조하도록.

- **[WARNING]** `rehydrateAndResume` 의 `resolvedNodeExecutionId` 변수가 `null | string` 으로 선언되고 try 블록 중간에서 설정됨
  - 위치: 1395번 라인
  - 상세: `let resolvedNodeExecutionId: string | null = null` 패턴은 제어 흐름을 통한 nullable 상태 추적으로, 읽는 사람이 "어느 시점에서 설정되는가"를 흐름 전체를 읽어야 알 수 있다. `RehydrationError` 를 throw 하는 구조이므로, 이 변수 없이 catch 블록에서 `nodeExecutionId` 의 resolve 여부를 별도로 체크하는 구조도 가능하다.
  - 제안: `resolvedNodeExecutionId` 대신 catch 블록에서 `nodeExec` 조회 결과를 직접 확인하거나, 변수를 `resolvedNodeExecId` 로 명확히 단축.

---

### websocket.gateway.ts

- **[WARNING]** 4개 핸들러(`handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation`)에서 `result.jobId === null` 분기 + 에러 응답 + 성공 응답 구조가 거의 동일하게 반복됨
  - 위치: 1821-1838, 1859-1875, 1904-1921, 1948-1966번 라인
  - 상세: 각 핸들러에서 `if (result.jobId === null) { return enqueueFailedResponse(event) }` 패턴이 4번 중복된다. 에러 메시지 문자열 `'Continuation enqueue failed (Redis unavailable)'` 도 4번 반복되어 매직 스트링이다.
  - 제안: `buildContinuationAck(event: string, result: ContinuationPublishResult, extra?: object)` 헬퍼 함수 추출 + 에러 메시지 상수화.

- **[INFO]** `'Continuation enqueue failed (Redis unavailable)'` 가 하드코딩된 문자열로 4곳에 반복
  - 위치: 1828, 1863, 1908, 1952번 라인
  - 상세: 매직 스트링. 테스트에서도 `/enqueue failed/` 정규식으로 검증하고 있어 불일치 위험이 있다.
  - 제안: `const ENQUEUE_FAILED_MESSAGE = 'Continuation enqueue failed (Redis unavailable)'` 상수 추출.

- **[INFO]** 응답 타입 정의 `data: { success: boolean; executionId?: string; resumed?: boolean; queued?: boolean; error?: string }` 이 4개 핸들러에 동일하게 반복됨
  - 위치: 1796-1805, 1884-1892, 1928-1937번 라인
  - 상세: 반환 타입 인라인 중복. 별도 타입 alias 가 없어 변경 시 4곳 모두 수정해야 한다.
  - 제안: `type ContinuationAckData = { success: boolean; executionId?: string; resumed?: boolean; queued?: boolean; error?: string }` 으로 추출.

---

### websocket.gateway.spec.ts

- **[INFO]** `{ queued: true, jobId: 'mock-job-id' }` 가 여러 mock 정의에 반복됨
  - 위치: 1719-1730번 라인
  - 상세: 4개 mock 모두 동일한 resolved value. 테스트 파일 내 상수로 추출하면 변경 시 단일 수정점이 된다.
  - 제안: `const MOCK_PUBLISH_SUCCESS = { queued: true, jobId: 'mock-job-id' }` 상수 추출.

---

### plan 문서 (파일 8, 9)

- **[INFO]** `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` 에서 "변경 2.3" 항목이 "Implementation 후행 작업"으로 분류되어 있으나 별도 plan 링크나 추적 식별자가 없음
  - 위치: 2071-2078번 라인
  - 상세: "별 PR 로 분리 권장" 이라고만 기술되어 있어 후속 작업의 추적 가시성이 낮다.
  - 제안: "별 PR 로 분리 권장" 표현에 향후 plan 파일명 또는 `TODO:` 마커 추가.

---

## 요약

이번 변경은 Redis pub/sub 기반 ContinuationBus 를 BullMQ 큐로 교체하고 Phase 2.3a 진짜 rehydration 로직을 추가한 대규모 구조 전환이다. 전반적인 설계 방향과 에러 분류 체계(`RehydrationError`, `RESUME_*` 코드)는 명확하며, 테스트 주석과 JSDoc 도 충실하다. 그러나 `websocket.gateway.ts` 의 4개 핸들러에서 동일한 jobId null 분기와 에러 메시지 문자열이 반복되는 중복 코드 문제가 가장 두드러지며, `resumeFromCheckpoint` 의 메서드 분량과 책임 과다도 장기 유지보수성에 부담이 된다. `continuation-execution.processor.ts` 에서 `await` 를 제거한 패턴은 향후 시그니처 변경 시 무소음 회귀 위험이 있다. 테스트의 rehydration 통합 시나리오(100줄 이상 단일 `it`)는 분리가 권장된다.

## 위험도

MEDIUM
