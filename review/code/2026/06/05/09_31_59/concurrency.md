# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] stageConversationThreadSnapshot — Execution 객체 in-memory 변이 후 트랜잭션 진입
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L8420–8424, 각 park 지점 (L3421, L4959, L5931 부근)
- **상세**: `stageConversationThreadSnapshot`은 동기 함수로, `Execution` 객체의 `conversationThread` 필드를 in-memory에서 변이한 뒤 호출자가 바로 `updateExecutionStatus`(DB 트랜잭션)를 실행한다. `updateExecutionStatus` 내부에서 `manager.save(Execution, execution)`이 변이된 객체 전체를 저장하므로 thread 스냅샷은 상태 전이와 **같은 트랜잭션** 안에 포함된다. 설계 의도대로 원자성은 보장된다.
  - 단, `stageConversationThreadSnapshot`과 `updateExecutionStatus` 사이에 `await`이 없는 동기 호출이므로 Node.js 단일 이벤트 루프 틱 안에서 순서가 보장된다. 추가 비동기 경로가 끼어들 여지가 없다.
  - cloneThread로 깊은 복사를 수행하므로 이후 `context.conversationThread`에 turn이 추가되어도 DB에 영속된 스냅샷(execution.conversationThread)이 오염되지 않는다. 올바른 처리.

- **제안**: 현행 패턴 유지. 향후 `stageConversationThreadSnapshot`을 async로 변환하거나 중간에 다른 await을 삽입하는 경우 반드시 stage → updateExecutionStatus 원자성을 재검토해야 한다는 주석을 추가하면 방어적이다.

---

### [INFO] rehydrateContext — createContext 후 in-memory 컨텍스트와 DB row 간 경쟁 없음 확인
- **위치**: `execution-engine.service.ts` L1198–1222 (`rehydrateContext`)
- **상세**: `rehydrateContext`는 새 `ExecutionContext`를 `contextService.contexts.get(key)` early-return 가드와 함께 생성한다. in-memory 컨텍스트가 이미 존재하면 즉시 반환하므로 동일 executionId로 두 인스턴스가 `rehydrateContext`를 경쟁적으로 호출할 경우 두 번째 호출은 첫 번째의 컨텍스트를 사용한다.
  - Node.js는 단일 스레드이므로 `contexts.get`/`contexts.set` 자체의 동시 접근 문제는 없다.
  - 단, 멀티 인스턴스 환경(수평 확장)에서 서로 다른 프로세스가 동일 executionId를 동시에 재개하려는 경우 DB 레벨의 상태 전이 가드(`assertTransition`)가 첫 번째 방어선이다. 이는 기존 설계의 책임 범위이며 이번 변경으로 새로 도입된 위험이 아니다.
- **제안**: 해당 없음. 이번 변경으로 인한 추가 위험 없음.

---

### [INFO] rehydrateConversationThread — 순수 함수, 동기, 부작용 없음
- **위치**: `codebase/backend/src/shared/conversation-thread/conversation-thread.types.ts` L992–1030
- **상세**: `rehydrateConversationThread`는 순수 동기 함수다. 외부 상태를 읽거나 쓰지 않으며, turns 배열을 `[...spread]`로 새 배열로 복사해 입력 원본을 변이하지 않는다. 동시성 위험 없음.
- **제안**: 해당 없음.

---

## 요약

이번 변경(PR-A1)은 `stageConversationThreadSnapshot` + `updateExecutionStatus` 조합으로 conversationThread 스냅샷을 상태 전이와 동일 트랜잭션 내에 원자적으로 commit하는 설계를 채택했다. Node.js 단일 이벤트 루프 특성상 두 호출 사이에 비동기 경쟁이 개입할 수 없으며, cloneThread를 통한 깊은 복사로 DB 영속본과 in-memory 컨텍스트 간 참조 오염을 방지했다. `rehydrateConversationThread`는 순수 동기 함수로 스레드 안전성 문제가 없다. 멀티 인스턴스 동시 재개에 대한 방어는 기존 `assertTransition` 가드가 담당하며 이번 변경으로 새로운 경쟁 조건이 도입되지 않았다. 전반적으로 동시성 관점에서 안전한 구현이다.

## 위험도
NONE
