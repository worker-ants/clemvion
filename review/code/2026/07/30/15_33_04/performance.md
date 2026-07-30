# 성능(Performance) 리뷰

대상 커밋: `2ca44b769 fix(engine): retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지 않던 결함 (8R CRITICAL)`
범위: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `engine-driver.interface.ts` (+ 컨텍스트로 제공된 `retry-turn.service.ts`, 이 커밋에서는 미변경)

## 발견사항

- **[INFO]** 두 static SQL 상수가 `Object.values(ExecutionStatus)` 를 각각 독립적으로 순회
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513`(`NON_TERMINAL_STATUSES_SQL`), `:534`(신규 `NON_TERMINAL_OR_FAILED_STATUSES_SQL`)
  - 상세: 신규 `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 이 `NON_TERMINAL_STATUSES_SQL` 과 별도로 `Object.values(ExecutionStatus).filter(...).map(...).join(', ')` 을 다시 실행한다. 둘 다 `private static readonly` 필드라 **클래스 로드(모듈 import) 시 단 1회**만 평가되고 이후 모든 호출(`lockNonTerminalExecutionRow`/`updateExecutionStatus` else 분기)은 사전 계산된 문자열을 재사용하므로 런타임 요청 경로에 어떤 반복 비용도 없다. `ExecutionStatus` 원소 수도 5~7개 수준으로 무시 가능한 상수 비용이다. 실질적 성능 영향은 0이며, 굳이 언급하는 이유는 "동일 소스에서 파생 가능한 두 상수를 두 번 순회"라는 사소한 중복이 존재한다는 관찰 차원(예: `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 을 `NON_TERMINAL_STATUSES_SQL` 파싱 없이 `[...nonTerminal, `'${ExecutionStatus.FAILED}'`].join(', ')` 형태로 파생할 수도 있음) — 가독성/DRY 문제이지 성능 문제는 아니다.
  - 제안: 조치 불필요(risk 없음). 굳이 정리한다면 두 상수 중 하나에서 다른 하나를 파생시켜 "같은 목적의 SQL 리스트가 두 곳에 손으로 유지된다"는 유지보수 관점만 개선 가능 — 성능 관점에서는 현행 유지로 충분.

- **[INFO]** 잠금 쿼리(`SELECT ... FOR UPDATE`)의 `WHERE status IN (...)` 목록이 조건부로 넓어짐 — 쿼리 카디널리티/복잡도는 불변
  - 위치: `execution-engine.service.ts:8168`(`lockNonTerminalExecutionRow`), `:8224`(`tryLockActiveExecutionAndSaveNodeExec`), `:8354`(`updateExecutionStatus`, else 분기 `elseStatusesSql` 선택은 `:8459`)
  - 상세: `opts?.allowRetryReentry` 로 두 정적 문자열 중 하나를 고르는 3항 연산은 O(1)이고, 실제 실행되는 쿼리는 여전히 `id = $1` 단건 PK 조회 + `FOR UPDATE`(그리고 else 분기는 단건 `UPDATE ... WHERE id = $1 AND status IN (...) RETURNING id`)로, 이번 변경 전후로 DB 호출 횟수·쿼리 형태·인덱스 사용 패턴이 동일하다. `IN (...)` 리스트에 원소가 하나(`'failed'`) 늘어도 PK 단건 조회 실행계획에는 영향이 없다. 즉 이 변경은 N+1 이나 쿼리 수 증가를 전혀 유발하지 않는다.
  - 제안: 없음 — 정보성 확인.

- **[INFO]** 파라미터 스레딩(`opts`)이 호출 체인 전반(`reparkAiResumeTurn`, `finalizeAiNode` 의 FAILED/RUNNING-유지 분기, `handleAiResumeTurn`)에 걸쳐 추가됐지만 전부 turn 당 1회 호출 지점
  - 위치: `ai-turn-orchestrator.service.ts:430`(`reparkAiResumeTurn` 시그니처+본문 453-458), `:1505`·`:1597`(`tryLockActiveExecutionAndSaveNodeExec` 호출부 2곳), `engine-driver.interface.ts:210-213`(타입 시그니처만 확장)
  - 상세: 4곳의 `reparkAiResumeTurn` 호출부(processAiResumeTurn 내 malformed payload / 대화계속 / stale button_click / unknown action 분기)는 전부 "그 turn 을 어떻게 마무리할지"를 결정하는 상호 배타적 분기이므로 실제 실행 시 1회만 탄다. `finalizeAiNode` 의 두 `tryLockActiveExecutionAndSaveNodeExec` 호출부도 `isFailed`/`savedExecution.status===RUNNING` 로 상호 배타적이다. 반복문 내부에서 이 함수들이 호출되는 경로는 없음(N+1 소지 없음). 조건부 객체 리터럴(`opts?.retryReentry ? { allowRetryReentry: true } : undefined`)도 turn 당 최대 1회의 작은 할당이라 메모리 영향 무시 가능.
  - 제안: 없음.

## 요약

이번 변경은 `execution.retry_last_turn` 재진입의 FAILED→RUNNING/FAILED→WAITING_FOR_INPUT 짝 전이가 DB 가드(`lockNonTerminalExecutionRow` 및 `updateExecutionStatus` else 분기)에서 항상 0행으로 막히던 correctness 결함을 고치는 커밋으로, 기존에 이미 확립된 "정적 SQL 리스트를 클래스 로드 시 1회 계산해 캐시"하는 패턴(`NON_TERMINAL_STATUSES_SQL`)을 그대로 재사용해 두 번째 상수(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)를 추가했을 뿐이다. 쿼리 수·호출 빈도·알고리즘 복잡도·메모리 사용 패턴 중 어느 것도 변경 전후로 달라지지 않으며, 모든 신규 파라미터 스레딩은 turn 당 1회 호출되는 상호 배타적 분기에 국한돼 반복 호출·N+1·블로킹 I/O 우려가 없다. 발견된 사항은 전부 INFO 수준의 사소한 관찰(중복 파생 가능한 상수 계산)이며 실질적 성능 리스크는 없다.

## 위험도

NONE
