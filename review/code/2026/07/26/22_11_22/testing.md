# 테스트(Testing) Review

## 발견사항

- **[WARNING]** `assertLinkedTransitionApplied` 가 던지는 `ExecutionCancelledError` 의 메시지 내용을 검증하는 테스트가 없다 — WARNING #7 회귀 재발 감지 불가
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:365-367` (`assertLinkedTransitionApplied` 의 `throw new ExecutionCancelledError(...)`), 테스트는 `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:182-208`, `233-254`, `361-393`, `498-526` (4개 "선점" 케이스) 전부
  - 상세: 이번 라운드의 Warning #7 fix 는 "예전 고정 접미사 `— skipping park` 가 phase 와 무관하게 붙던 문제"를 `phase` 값 하나로만 메시지를 구성하도록 고쳤다(`Execution ${executionId} cancelled during ${phase}`). 그런데 4개 소비처(re-park·첫 turn park·retry-last-turn RUNNING 재claim·CRITICAL #1 RUNNING 유지) 테스트는 전부 `.rejects.toBeInstanceOf(ExecutionCancelledError)` 만 단언하고 `.message`/`phase` 문자열은 전혀 확인하지 않는다. 즉 누군가 4곳 중 한 곳에서 phase 문자열을 실수로 하드코딩하거나 예전 접미사를 되살려도(정확히 이번에 고친 그 버그의 재발) 어떤 테스트도 RED 로 떨어지지 않는다 — instanceof 단언은 메시지 내용에 무관하다.
  - 제안: 각 소비처 테스트에 최소 하나씩 `.rejects.toThrow(/cancelled during AI turn — re-park/)` 류의 phase 문자열 단언을 추가해 WARNING #7 fix 를 회귀 테스트로 고정한다.

- **[WARNING]** 신규 e2e "턴 진행 중 Stop" 테스트가 turn-finalize 완료 대기에 고정 `setTimeout(2_500ms)` 를 쓴다 — 프로젝트 자체 컨벤션(고정 sleep 금지)과 상충하고 느린 CI 에서 flake 위험
  - 위치: `codebase/backend/test/execution-park-resume.e2e-spec.ts:1215` (`await new Promise((r) => setTimeout(r, 2_500));`)
  - 상세: 같은 테스트의 "RUNNING 관측" 단계는 `poll(executionId, (s) => s === 'running', 5_000, 50)` 로 정확히 이 프로젝트 컨벤션(`node-cancellation-propagation.e2e-spec.ts` 선례, 고정 sleep 대신 poll)을 따르면서, 바로 다음 단계(지연된 LLM 응답 도착 후 `finalizeAiNode` 가 실제로 완주했는지 확인)는 다시 고정 2.5초 sleep 으로 되돌아간다. 이 파일에는 이미 재사용 가능한 `poll()` 헬퍼가 있다(`execution-park-resume.e2e-spec.ts:118`, `783`). CI 부하가 커서 지연(1200ms)+큐 처리 시간이 2.5초를 넘으면 마지막 `finalNode.rows[0]?.status).toBe('cancelled')` 단언이 (버그와 무관하게) 실패해 flake 를 유발한다 — 역으로 로컬처럼 여유가 있으면 통과하지만 그 통과가 "finalize 가 실제로 실행됐다"를 보장하지 않는 시간대(sleep 이 조금이라도 짧으면)도 이론상 존재한다.
  - 제안: 고정 sleep 대신 `node_execution` 행이 terminal 상태(`cancelled`/`completed`)로 전이할 때까지 poll 하는 방식으로 바꾸면 더 빠르고 CI 부하에도 견고해진다.

- **[INFO]** `NON_TERMINAL_STATUSES_SQL` FOR UPDATE 쿼리 검증이 `ExecutionStatus` enum 멤버 선언 순서에 암묵적으로 결합됨
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:4989-4993` (`expect(mockTxManagerQuery).toHaveBeenCalledWith(expect.stringMatching(/status IN \('pending', 'running', 'waiting_for_input'\)/), ...)`)
  - 상세: `NON_TERMINAL_STATUSES_SQL` 은 `Object.values(ExecutionStatus)` 순서대로 필터링해 조인한 문자열이라, 실제 SQL 의미(`IN (...)` 는 순서 무관)와 달리 테스트는 특정 순서를 하드코딩한다. `ExecutionStatus` enum 멤버 선언 순서가 바뀌면(의미상 무해한 변경) 이 테스트만 거짓으로 RED 가 될 수 있다.
  - 제안: 순서 무관 단언(예: 세 상태 문자열 각각을 `expect.stringContaining` 으로 개별 확인하거나, 생성 로직과 동일한 소스에서 기대값을 산출)으로 바꾸면 더 견고하다. 우선순위는 낮음(현재 정확히 통과하고, enum 재정렬은 흔치 않음).

- **[INFO]** WARNING #10 (outputData/error 취소 위생) 회귀는 4개 소비처 중 1곳(retry-last-turn 재claim)에서만 직접 검증됨
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:420` (`markNodeCancelled 호출 전 outputData/error 를 비워...`) vs CRITICAL #1 블록(`:462-526`)은 이 필드를 확인하지 않음
  - 상세: `assertLinkedTransitionApplied` 는 4개 소비처가 공유하는 단일 private 헬퍼이므로 한 곳에서 검증하면 이론상 나머지도 커버되지만, CRITICAL #1(가장 최근에 추가된, 그리고 실제로 "정상 multi-turn 대화 종료의 주 경로"로 문서화된 분기)에서는 이 위생 동작이 명시적으로 재확인되지 않는다. 회귀 시(예: 특정 호출부만 다른 인자를 넘기게 되는 실수) 감지가 늦어질 수 있다.
  - 제안: 우선순위 낮음 — 시간이 될 때 CRITICAL #1 테스트에도 `outputData`/`error` 초기화 단언을 추가하면 4개 소비처 대칭 커버리지가 완성된다.

## 요약

이번 diff 의 테스트 추가는 전반적으로 우수하다 — 4개 짝 전이 소비처(re-park, 첫 turn park, retry-last-turn RUNNING 재claim, CRITICAL #1 RUNNING 유지 분기) 각각에 대해 "선점(false/cancelled)" 케이스와 "대조(true/정상)" 케이스를 쌍으로 갖춰 분기 커버리지가 촘촘하고, `nodeExec === null` mutation 사각지대를 스스로 찾아 고정한 테스트를 추가한 점(§주석에 명시)은 이 프로젝트가 반복 지적해온 "mutation 사각지대 방치" 문제를 스스로 예방한 좋은 사례다. `beforeEach` 가 매 테스트마다 driver mock·컨텍스트·리포지토리 mock 을 전부 새로 생성해 테스트 격리도 견고하고, e2e 신규 테스트는 "RUNNING 관측"에 poll 을 써 고정 sleep 을 피하는 프로젝트 컨벤션을 따른다. 다만 (1) 이번에 고친 에러 메시지 포맷(WARNING #7, 접미사 제거)에 대한 직접 회귀 테스트가 없고, (2) 같은 e2e 테스트가 "관측" 단계와 달리 "완료 대기" 단계에서는 고정 2.5초 sleep 으로 되돌아가 CI 부하 시 flake 위험이 있다는 점은 보완이 필요하다. 두 항목 모두 현재 기능을 막을 정도는 아니며 후속 보강으로 충분하다.

## 위험도

LOW
