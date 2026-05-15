## 리뷰 결과

### 발견사항

- **[INFO]** `findActivePlanContext` 이중 호출로 인한 컨텍스트 비대칭
  - 위치: `workflow-assistant-stream.service.ts` — 시스템 프롬프트 조립부 vs `evaluateFinishGuard`
  - 상세: 시스템 프롬프트 생성 시 `findActivePlanContext(history, null, [], dto.content)`(빈 pendingToolCalls), `evaluateFinishGuard` 내부에서 `findActivePlanContext(history, planForTurn, pendingToolCalls, ...)` (누적된 툴콜 포함)로 각각 호출된다. 두 호출 사이에서 `completedStepIds`가 다르게 계산될 수 있다. 단일 Node.js 이벤트 루프 내에서 순차 실행되므로 실제 경쟁 조건은 없지만, 동일 턴 내에서 guard 판단 기준(툴콜 누적 후)과 프롬프트 내용(턴 시작 시점 snapshot)이 다를 수 있어 미완료 step이 프롬프트엔 `[ ]`로 보이지만 guard에서는 완료로 판단되는 시각 불일치가 발생할 수 있다.
  - 제안: 의도된 설계라면 주석으로 명시("프롬프트는 turn-start snapshot, guard는 in-flight snapshot"). 불일치가 문제라면 guard 결과에서 `completedStepIds`를 재사용할 것.

- **[INFO]** 세션 동시 요청에 대한 가드가 현재 코드 범위 밖
  - 위치: `streamMessage` 메서드 전체
  - 상세: 스펙(§10)은 "워크플로우당 활성 스트리밍 1건만 허용, 중복 POST 시 409"를 명시하지만, 해당 서비스 레이어에는 이를 강제하는 코드가 없다. 두 요청이 동시에 `loadMessages → persistAssistantTurn` 사이클을 돌면 history 기반 `findActivePlanContext`가 같은 stale history를 기반으로 계산되어 `clear_plan` 감지 또는 `completedStepIds` 집계가 틀어질 수 있다. HTTP 레이어에서 강제된다면 무방하나, 현재 코드만 보면 보장이 없다.
  - 제안: 컨트롤러 또는 이 서비스 진입부에 세션 ID 기반 `in-progress Set` 또는 DB 레벨 lock 확인 로직을 추가해 이중 스트림을 명시적으로 차단.

- **[INFO]** `hasClearPlanAfter` 슬라이싱 범위 — `planIndex` 포함
  - 위치: `active-plan-context.ts:72` — `history.slice(planIndex)`
  - 상세: `history.slice(planIndex)`는 plan이 담긴 메시지 자체도 포함하므로, plan 메시지가 동시에 `clear_plan` toolCall을 가지고 있다면 자기 자신에 의해 cleared 판정이 날 수 있다. 실제로 `propose_plan`과 `clear_plan`이 같은 assistant 메시지에 공존하는 케이스는 비정상이지만, edge case로 `planIndex + 1`이 더 안전하다.
  - 제안: `history.slice(planIndex + 1)`로 변경해 plan 메시지 이후부터만 스캔.

---

### 요약

변경된 코드는 Node.js 단일 이벤트 루프 환경에서 동작하는 순차 비동기 코드다. `async/await`, `for await` 모두 올바르게 사용되어 있으며, 실질적인 스레드 경쟁 조건이나 데드락 위험은 없다. `planClearedThisTurn`, `planForTurn`, `pendingToolCalls` 등의 가변 상태는 모두 단일 요청의 스택 로컬로 격리되어 있고, `findActivePlanContext`는 순수 함수로 공유 상태를 변이하지 않는다. 다만 동일 세션에 대한 동시 HTTP 요청 차단이 현재 코드 레이어에서 보장되지 않는 점, 그리고 시스템 프롬프트와 `evaluateFinishGuard`가 같은 턴 내에서 서로 다른 시점의 `pendingToolCalls`를 기반으로 컨텍스트를 계산하는 의도적 비대칭이 장기 유지 시 혼란을 줄 수 있는 구조적 주의 사항으로 남는다.

### 위험도

**LOW**