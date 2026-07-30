# Testing 리뷰 — retry 재진입 짝 전이 DB 가드 결함 수정 (8R CRITICAL) 재검토

## 검증 방법

정적 리딩에 더해 실제로 관련 스펙을 실행해 회귀 여부를 확인했다.

```
npx jest state/state-machine.spec.ts ai-turn-orchestrator.service.spec.ts retry-turn.service.spec.ts
  → 3 suites / 153 tests, 전부 PASS

npx jest execution-engine.service.spec.ts
  → 1 suite / 438 tests, 전부 PASS
```

기존 테스트는 회귀 없이 그대로 유효하다(회귀 테스트 관점 OK).

## 발견사항

- **[CRITICAL]** 이번 fix가 실제로 고치는 두 경로(turn 즉시 종료 / turn 계속) 중, "가장 흔하다"고 커밋 메시지 스스로 명시한 **"turn 계속 → re-park(FAILED→WAITING_FOR_INPUT)" 경로에 대한 회귀 테스트가 전혀 없다.**
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:430-457` (`reparkAiResumeTurn` — `opts?.retryReentry ? { allowRetryReentry: true } : undefined` 전파)
  - 상세: 확인한 3개 spec 파일 전부에서 이 경로가 `dbExecutionStatus=FAILED` + `allowRetryReentry:true` 조합으로 실제 실행되는 테스트가 없다.
    1. `ai-turn-orchestrator.service.spec.ts:111-119` — `describe('reparkAiResumeTurn — EngineDriver seam')`의 `ReparkSubject` 타입이 새 5번째 `opts` 파라미터를 아예 선언하지 않고, 5개 테스트(130/161/189/225/248행) 모두 `opts` 없이 호출한다. `savedExecution.status`도 전부 `RUNNING`이라 애초에 `allowRetryReentry`가 필요 없는 시나리오다.
    2. `ai-turn-orchestrator.service.spec.ts:759-793`, `860-` — `processAiResumeTurn`을 직접 구동하는 두 테스트도 8번째 `opts` 인자를 넘기지 않는다(`finalizeOpts`가 `undefined`로 귀결).
    3. `execution-engine.service.spec.ts:16732-` (`describe('applyRetryLastTurn (multi-turn loop re-entry)')`, real `RetryTurnService`+`AiTurnOrchestrator`+`ExecutionEngineService` 협업 + 이번 커밋이 고친 honest mock 사용) — 이 describe 안의 모든 `processReturn`이 `status:'ended'`(정상 종료) 또는 예외 throw(재실패)만 반환하고, "대화가 계속된다"(handleAiMessageTurn의 `ended:false` 분기)를 유발하는 시나리오가 없다. 즉 이 describe는 case (a)(즉시 종료/재실패)만 커버하고 case (b)(re-park)는 건드리지 않는다.
    4. `retry-turn.service.spec.ts:727-738` (`'returns without resuming graph when re-entry re-parks (PARK_RELEASED)'`) — `mockAiTurnOrchestrator.processAiResumeTurn`을 통째로 mock해 `PARK_RELEASED`를 즉시 반환시키므로, 그 안에서 실제로 일어나야 할 `reparkAiResumeTurn → updateExecutionStatus(WAITING_FOR_INPUT, {allowRetryReentry:true})` DB 가드 호출 자체가 발생하지 않는다.
  - 이 조합(FAILED 소스 + WAITING_FOR_INPUT 타겟 + opt-in)에 대한 실제 SQL/DB 가드 레벨 검증은 `state-machine.spec.ts`의 순수 `canTransition` 단위 테스트뿐이다 — `updateExecutionStatus`의 `linkedNodeExec` 분기(`lockNonTerminalExecutionRow` 경유)가 실제로 opts를 받아 SQL의 `status IN (...)`에 `'failed'`를 넣는지는 이 특정 호출 경로에서 전혀 검증되지 않는다.
  - 왜 위험한가: 이 커밋 자체가 "mock 하드코딩이 이 결함을 8라운드 동안 은폐했다"고 명시한다. 지금 고친 것과 똑같은 클래스의 결함(단순 forwarding 누락)이 향후 리팩터링(이 파일은 god-class 분해가 진행 중이라 편집 빈도가 높다 — C-1 step2/3/4, ISP 슬라이스 주석 다수)으로 `reparkAiResumeTurn`의 `opts` 전달이 다시 빠져도, 현재 테스트 스위트는 **아무 것도 RED로 떨어뜨리지 못한다.**
  - 제안: `execution-engine.service.spec.ts`의 `applyRetryLastTurn` describe에 "재시도된 turn이 종료하지 않고 계속된다" 시나리오(예: `processMultiTurnMessage`가 `status:'ended'`가 아닌 continuation 출력을 반환하도록)를 1건 추가하고, `dbExecutionStatus=FAILED`(이미 helper가 세팅) 상태에서 `retryTurnService.applyRetryLastTurn(...)` 호출 후 Execution이 `WAITING_FOR_INPUT`으로 정상 re-park됐는지(=`ExecutionCancelledError`가 아닌지, `EXECUTION_WAITING_FOR_INPUT` 계열 emit이 발생했는지)를 단언한다. 이는 "re-failure (retryable again)" 테스트(16893행)와 대칭되는 세 번째 케이스다.

- **[WARNING]** `updateExecutionStatus`의 `linkedNodeExec` 분기와 `tryLockActiveExecutionAndSaveNodeExec`을 직접 겨냥하는 **전용(focused) describe 블록 2곳이 새 `opts` 파라미터를 전혀 인지하지 못한다** — 타입 캐스팅 자체가 구식이다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5279-5399` (`describe('linkedNodeExec 짝 전이 — terminal 가드 ...')`), `:5442-5520` (`describe('tryLockActiveExecutionAndSaveNodeExec — ...')`, 특히 `priv()` 타입 정의 `:5443-5449`가 3번째 `opts` 인자를 선언하지 않음)
  - 상세: 두 블록 모두 `exec.status`로 `RUNNING`/`PENDING`만 쓰고 `FAILED`는 등장하지 않으며, 4번째(또는 3번째) `opts` 인자를 넘기는 테스트가 하나도 없다. 실제 opts 전파에 대한 검증은 이 전용 블록이 아니라 훨씬 거리가 먼 `applyRetryLastTurn` 통합형 테스트(16732행~)가 우연히 이 코드 경로를 지나가면서 간접적으로 수행한다 — 그 통합 테스트가 스코프를 바꾸거나 삭제되면 이 파라미터에 대한 유일한 안전망도 함께 사라진다.
  - 제안: 두 블록에 `updateExecutionStatus`의 else 분기용으로 이미 추가된 패턴(`execution-engine.service.spec.ts:5111-5152`, SQL에 `'failed'` 포함 여부 직접 단언)과 동일하게, `linkedNodeExec` 분기·`tryLockActiveExecutionAndSaveNodeExec`에도 "opt-in 시 FOR UPDATE 쿼리가 `'failed'`를 포함한다/포함하지 않는다" 테스트를 로컬로 추가하면, 회귀 시 실패 지점이 훨씬 명확해진다.

- **[WARNING]** `retry_last_turn` 전체 흐름(WS `execution.retry_last_turn` 커맨드 → `retryLastTurn` → `publishRetryLastTurn` → continuation worker → `applyRetryLastTurn`)에 대한 **e2e(`*.e2e-spec.ts`) 테스트가 전무하다.**
  - 위치: `codebase/backend/test/*.e2e-spec.ts` 전체에서 `retry_last_turn`/`retryLastTurn` grep 결과 0건(대조: `execution-crash-redrive.e2e-spec.ts`, `execution-stalled-redelivery.e2e-spec.ts`, `execution-park-resume.e2e-spec.ts` 등 인접 기능은 e2e가 있다).
  - 상세: 이번 결함은 정확히 "실제 Postgres SQL의 `status IN (...)` 목록이 opts를 반영하지 못하는" 문제였는데, 이를 8라운드 동안 가린 것은 실제 DB가 아니라 손으로 짠 mock(`mockTxManagerQuery`)이었다. 이번 수정으로 그 mock은 "SQL 문자열에 특정 quoted 리터럴이 포함되는지"를 검사하는 좀 더 정교한 문자열 매칭으로 바뀌었지만(`execution-engine.service.spec.ts:277-284`), 여전히 실제 Postgres round-trip(`FOR UPDATE`, `jsonb_exists`, 트랜잭션 원자성)을 대체 검증하는 것이지 실제로 실행하는 것은 아니다. 프로젝트 자체 이력(`refactor 06 C-2 원자 claim` 계열)에서도 "동시성·상태전이 버그는 e2e만 포착하고 unit은 미검출"이었던 선례가 있다.
  - 제안: CRITICAL은 아니나, `retry_last_turn` WS 커맨드 왕복(2차 turn 계속/2차 turn 종료 양쪽)을 검증하는 `execution-*.e2e-spec.ts`류 backstop을 백로그에 등재할 것을 권고한다.

- **[INFO]** `assertTransition`의 새 boundary(`FAILED → WAITING_FOR_INPUT`)에 대한 직접 단위 테스트가 없다.
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.spec.ts` (`describe('assertTransition')`, 175-193행 부근) — `FAILED → RUNNING` opt-in 유무만 확인하고 `FAILED → WAITING_FOR_INPUT`는 `canTransition`으로만 검증됨.
  - 상세: `assertTransition`은 `canTransition`의 단순 위임(`if (!canTransition(...)) throw`)이라 실질 리스크는 낮다. `canTransition` 쪽은 새 boundary(허용/차단/다른 타겟 불변)를 3건으로 꼼꼼히 커버해 실질 커버리지 공백은 거의 없다.
  - 제안: 선택 사항 — 대칭성을 위해 1줄 테스트 추가 가능하나 우선순위 낮음.

## 긍정적으로 확인된 점

- `state-machine.spec.ts`에 추가된 3건은 경계값을 잘 짚는다: opt-in 있을 때 `FAILED→WAITING_FOR_INPUT` 허용, opt-in 없을 때 차단, opt-in이 있어도 `FAILED→{COMPLETED,CANCELLED,PENDING}`은 여전히 차단(표가 넓어지지 않음을 확인) — mutation 관점에서 "opt-in이 전체 FAILED 표를 여는" 방향 뮤턴트를 잡는 테스트다.
- `execution-engine.service.spec.ts`의 `mockTxManagerQuery`가 SQL·상태 무관 항상-성공에서 "SQL의 `status IN (...)`과 `dbExecutionStatus`를 실제로 대조"하는 방식으로 바뀐 것은 실질적 개선이다 — 이 mock이 정직해진 덕분에 기존 3개 통합 테스트(`applyRetryLastTurn` 스위트의 `dbExecutionStatus = ExecutionStatus.FAILED` 3곳)가 손대지 않고도 회귀 감지력을 얻었다.
- `updateExecutionStatus`의 else 분기에 새로 추가된 2건(`execution-engine.service.spec.ts:5111-5152`)은 SQL 문자열 내용을 직접 단언(`toContain("'failed'")`/`not.toContain(...)`)하는 방식으로, mock의 행동을 흉내내지 않고 실제 생성된 SQL을 검증한다 — 신뢰도가 높은 패턴이다.
- 테스트 격리: `beforeEach`가 `mockTxManagerQuery`/`dbExecutionStatus`/repo mock을 매 테스트 새로 생성하며, 591개 테스트(state-machine 3 + ai-turn-orchestrator 통합 + retry-turn 153 + execution-engine 438)를 직접 실행해 순서 의존성 없이 전부 PASS함을 확인했다.
- 테스트 가독성: 각 신규 테스트가 ai-review 라운드/날짜/시나리오(a)/(b)를 명시적으로 주석에 남겨 왜 이 테스트가 존재하는지 추적 가능하다.

## 요약

핵심 상태-머신 로직(`canTransition`)과 "turn 즉시 종료"(case a) 시나리오는 실제 서비스 협업(real `RetryTurnService`+`AiTurnOrchestrator`+`ExecutionEngineService`)과 "honest" mock으로 잘 회귀 잠금이 됐고, 관련 591개 테스트를 직접 실행해 전부 통과함을 확인했다. 다만 커밋 메시지가 "가장 흔한 시나리오"로 지목한 "turn 계속 → re-park(FAILED→WAITING_FOR_INPUT)" 경로는 세 개의 관련 spec 파일(orchestrator 단위, engine 통합, retry-turn 단위) 어디에서도 opts 전파가 실제로 SQL까지 도달하는지 검증하지 않는다 — mock이 그 경로를 아예 우회하거나(retry-turn.service.spec.ts), 시나리오 자체가 등장하지 않는다(execution-engine.service.spec.ts). 이 결함이 애초에 "mock이 8라운드 동안 진실을 가렸다"는 교훈에서 나온 fix라는 점을 감안하면, 정확히 같은 종류의 사각지대가 가장 중요한 경로에 하나 남아있는 셈이다. 그 외 두 전용 unit describe 블록(linkedNodeExec 짝 전이 / tryLockActiveExecutionAndSaveNodeExec)이 새 파라미터를 인지하지 못하는 점과 retry_last_turn 전체에 e2e가 전무한 점은 WARNING 수준의 구조적 공백이다.

## 위험도

HIGH
