## 발견사항

- **[INFO]** `get_current_workflow` 핸들러가 동기 코드로 구현됨
  - 위치: `workflow-assistant-stream.service.ts` — `buildCurrentWorkflowResult` 메서드
  - 상세: `shadow.snapshot()`을 호출한 뒤 `snap.nodes`와 `snap.edges`를 동기적으로 매핑한다. `await`가 없으므로 이벤트 루프를 양보하지 않고 즉시 반환한다. 결과적으로 `for await` 루프 내 다른 연산이 중간에 끼어들 수 없어 원자성이 자연스럽게 보장된다.

- **[INFO]** `shadow` 인스턴스가 요청 범위(request-scoped)로 격리됨
  - 위치: `streamMessage` 최상단 — `const shadow = new ShadowWorkflow(...)`
  - 상세: 매 `streamMessage` 호출마다 새 `ShadowWorkflow` 인스턴스가 생성된다. 인스턴스는 클로저 변수로 `while(true)` 루프 전체에 걸쳐 동일 컨텍스트에서만 읽히고 쓰인다. 여러 HTTP 요청이 동시에 들어와도 각자의 `shadow`를 별도로 소유하므로 교차 요청 경쟁 조건은 없다.

- **[INFO]** 멀티-라운드 루프 간 `shadow` 상태 공유가 의도적임
  - 위치: `while(true)` 루프 — `add_node` → (다음 라운드) → `get_current_workflow` 순서
  - 상세: `add_node`가 `shadow.apply()`로 상태를 변경하면, 같은 턴의 다음 라운드에서 `get_current_workflow`가 `shadow.snapshot()`으로 그 결과를 읽는다. 이는 설계된 동작이며 테스트 `'reflects in-turn edits when get_current_workflow is called after add_node'`가 이를 검증한다. Node.js 단일 스레드 모델에서 두 연산은 항상 순차 실행되므로 경쟁 조건이 발생하지 않는다.

- **[INFO]** `snapshot()` 반환값의 불변성 의존
  - 위치: `buildCurrentWorkflowResult` — `const snap = shadow.snapshot()`
  - 상세: `snap.nodes`와 `snap.edges`를 매핑하는 사이에 `shadow`의 내부 상태가 변경된다면 결과가 불일치할 수 있다. 단, 동기 함수 내부이므로 Node.js 이벤트 루프가 중간에 다른 마이크로태스크를 실행할 여지가 없어 실제 위험은 없다. `ShadowWorkflow.snapshot()`이 내부 배열의 얕은 복사본을 반환하는지 깊은 복사본을 반환하는지 코드에서 확인하지 못했으나, 어느 쪽이든 이 호출 컨텍스트에서는 안전하다.

---

## 요약

변경 범위 전체가 단일 요청 내 순차 실행 흐름(async generator + `for await` 루프)에 국한된다. `get_current_workflow` 핸들러는 동기적이고 무상태(stateless)이며, `shadow` 객체는 요청 단위로 완전히 격리된다. 공유 가변 상태, 락, 외부 비동기 I/O가 추가되지 않았으므로 경쟁 조건, 데드락, 스레드 안전성 문제 모두 해당 없다. `frontend/package-lock.json`의 `peer` 플래그 변경은 동시성과 무관하다.

## 위험도

**NONE**