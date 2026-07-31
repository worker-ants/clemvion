# 동시성(Concurrency) 리뷰 — retry 재진입 짝 전이 DB 가드 opts 전파 수정 (8R CRITICAL)

## 스코프

리뷰 대상 5개 파일 중 이번 커밋(`2ca44b769` "retry 재진입 짝 전이가 DB 가드에 막혀 절대
persist 되지 않던 결함")의 실제 diff는 `state-machine.ts` / `execution-engine.service.ts` /
`ai-turn-orchestrator.service.ts` / `engine-driver.interface.ts` 4개에 있고,
`retry-turn.service.ts`는 호출 체인 이해를 위한 컨텍스트(이번 커밋에서 무변경)다.

수정 내용: `execution.retry_last_turn` 재진입이 의존하는 FAILED→RUNNING /
FAILED→WAITING_FOR_INPUT 짝 전이가 상태머신(`allowRetryReentry` opt-in)에서는
허용되면서도, 그 직후의 DB 레벨 가드(`lockNonTerminalExecutionRow` 및
`updateExecutionStatus`의 두 분기)가 `opts`를 전혀 전파하지 않아 항상 0행 매칭 →
`persisted=false`가 되어 재진입이 구조적으로 절대 persist 될 수 없었던 CRITICAL을
바로잡는다. 부수적으로 state-machine의 opt-in 허용 범위를 FAILED→WAITING_FOR_INPUT
(재-park 시나리오)까지 넓혔다.

## 발견사항

- **[INFO]** 8R CRITICAL 수정 자체 검증 — 정확함, 전체 호출 체인 추적 완료
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8420-8424`
    (`updateExecutionStatus`의 `linkedNodeExec` 분기 — `lockNonTerminalExecutionRow(manager, execution.id, opts)`),
    `:8459-8461`(else 분기의 `elseStatusesSql` 선택), `:8168-8184`(`lockNonTerminalExecutionRow`),
    `:8224-8253`(`tryLockActiveExecutionAndSaveNodeExec`)
  - 상세: 수정 전에는 `updateExecutionStatus`의 `linkedNodeExec` 분기가
    `lockNonTerminalExecutionRow`를 opts 없이 호출했다 — 함수 최상단의
    `assertTransition(execution.status, newStatus, opts)`는 opts를 정상 수신해
    FAILED→RUNNING/WAITING_FOR_INPUT을 통과시키지만, 그 직후 DB 잠금 조회는 opts
    없이 항상 `NON_TERMINAL_STATUSES_SQL`(FAILED 배제)만 써서 대상 행이 FAILED인
    한 항상 0행 — caller(`assertLinkedTransitionApplied`)가 이를 "동시 cancel
    선점"으로 오판해 짝 NodeExecution을 CANCELLED로 재마킹하고
    `ExecutionCancelledError`를 던졌다(정상 재진입이 매번 취소로 오분류). 동일
    패턴이 `tryLockActiveExecutionAndSaveNodeExec`(opts 파라미터 자체가 없었음)와
    else 분기(항상 `NON_TERMINAL_STATUSES_SQL` 고정)에도 있었다. 이번 diff는 세
    지점 모두에서 `opts`를 그대로 전달하도록 고쳤다.
    `ai-turn-orchestrator.service.ts`의 3개 소비처 — `reparkAiResumeTurn`
    (`:430-458`, `opts?.retryReentry ? {allowRetryReentry:true}:undefined`를
    `updateExecutionStatus` 4번째 인자로 전달), `finalizeAiNode`의 isFailed 분기
    (`:1505-1509`, `tryLockActiveExecutionAndSaveNodeExec`) 및 RUNNING 재claim
    분기(`:1615-1620`, `updateExecutionStatus`) — 가 모두 `allowRetryReentry`를
    실제로 전파하는지 grep으로 전수 확인했다. `reparkAiResumeTurn`의 4개 호출부
    (`processAiResumeTurn` 내부, malformed payload/turn 계속/button_click/unknown
    각 분기)가 전부 `finalizeOpts`를 넘기고, `processAiResumeTurn`의 2개 caller
    (`handleAiResumeTurn`=일반 §7.5 rehydration, opts 미전달=의도됨 /
    `retry-turn.service.ts:458`의 `applyRetryLastTurn`=`{retryReentry:true}`)도
    정합적이다. `state-machine.ts`의 opt-in 확장(`:73-76`,
    FAILED→WAITING_FOR_INPUT 추가)도 `assertTransition`이 항상 함수 최상단에서
    먼저 걸리므로(`updateExecutionStatus:8360`), DB 레벨 SQL 확장이 상태머신보다
    더 넓은 전이를 허용하는 이중 가드 붕괴 위험은 없다.
  - 제안: 없음(정확). `npx jest state-machine.spec.ts
    ai-turn-orchestrator.service.spec.ts execution-engine.service.spec.ts
    retry-turn.service.spec.ts`를 직접 실행해 591개 테스트 전부 통과를 확인했다.

- **[INFO]** 테스트 하네스 자체의 8라운드 맹점 제거 — 결함 아님, 리뷰 신뢰도 향상 사항
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts`의
    `mockTxManagerQuery` (최상단 `beforeEach` 블록, `dbExecutionStatus` 변수와 함께)
  - 상세: 기존 mock은 SQL 내용·현재 status와 무관하게 항상 `[{id}]`(잠금 성공)를
    반환해, DB 가드가 FAILED를 배제한다는 사실이 8라운드 동안 GREEN 뒤에
    숨어있었다(짝 전이가 실제로는 늘 0행이었는데도 테스트는 통과). 이번 diff는
    mock이 실제 SQL의 `status IN (...)` 목록과 `dbExecutionStatus`(직전 `save()`
    호출로 갱신되는 시뮬레이션 DB 상태)를 실제로 대조하도록 바꿔, opts 누락 시
    RED가 되는 회귀 테스트로 전환했다(주석의 "뮤턴트 C" 언급대로 mutation으로
    검증됨). 동시성 코드에서 "형태는 있으나 내용을 검증하지 않는 mock"은 전형적인
    vacuous-test 패턴인데, 이번 수정이 그 구조적 원인을 제거했다.
  - 제안: 없음(개선 확인).

- **[INFO]** `finalizeAiNode`의 RUNNING 유지 분기 — 추가된 opts 전달이 retry 재진입
  경로에서는 현재 도달 불가능(무해)
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1600`
    (`allowRetryReentry ? { allowRetryReentry: true } : undefined,` —
    `tryLockActiveExecutionAndSaveNodeExec` 3번째 인자, `if (savedExecution.status
    === ExecutionStatus.RUNNING)` 분기 내부 `:1596`)
  - 상세: `applyRetryLastTurn`(retry-turn.service.ts)이 `processAiResumeTurn`을
    호출할 때 넘기는 `execution`(=`savedExecution`)의 `.status`는 재진입 처리
    내내 최초 로드 값(FAILED)으로 고정된다 — `rehydrateContext`를 포함해 그
    사이 어떤 코드도 이 in-memory 값을 RUNNING으로 갱신하지 않음을 직접 추적으로
    확인했다. 따라서 `retryReentry===true`인 유일한 실제 실행 경로에서
    `savedExecution.status===RUNNING` 조건은 항상 거짓이라, 이번에 추가된
    opts 전달은 현재 도달 불가능한 조합이다. 위험은 없으나(harmless), 테스트로
    검증되지 않는 분기로 남는다는 점만 기록한다(실제로 `ai-turn-orchestrator.service.spec.ts`의
    해당 diff는 기존 단언에 `undefined` 세 번째 인자만 추가했을 뿐, `{allowRetryReentry:true}`
    조합에 대한 신규 단언은 없다).
  - 제안: 조치 불요. 향후 이 조합이 실제로 필요해지는 리팩터가 있을 때 회귀
    테스트를 추가하면 된다.

- **[WARNING]** 이번 fix로 "형제 FAILED 멀티턴 노드의 동시 retry_last_turn" 경로가
  처음으로 실제 동작하게 됨 — 스코프 확인 권고
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:73-77`
    (opt-in 판정), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8168-8184`
    (`lockNonTerminalExecutionRow`), `:8354-8441`(`updateExecutionStatus`
    linkedNodeExec 분기)
  - 상세: 수정 전에는 FAILED→RUNNING/WAITING_FOR_INPUT 짝 전이가 구조적으로
    항상 실패했으므로(위 CRITICAL 항목), 하나의 Execution 아래 서로 다른 두
    FAILED 멀티턴 AI 노드(예: Parallel 형제 브랜치가 각각 retryable 오류로 종료된
    경우)가 동시에 `retry_last_turn`을 호출해도 둘 다 결정적으로 실패해 경쟁
    조건이 드러날 수 없었다. 이번 fix로 그 짝 전이가 실제 persist 되면서 이
    경로가 처음 "활성화"된다. `SELECT ... FOR UPDATE` 행 잠금 + `status IN (...)`
    조건은 **동일 시점의 단일 시도**에 대한 lost-update는 막지만, 한쪽이 먼저
    성공해 Execution이 RUNNING 또는 WAITING_FOR_INPUT으로 바뀐 뒤에는 그 두
    상태가 opt-in 여부와 무관하게 항상 "non-terminal"에 포함되므로, 뒤따르는
    형제 노드의 재진입도 동일 Execution 행에 대해 잠금을 얻고 자신의 전이를
    적용할 수 있다 — 서로 다른 두 NodeExecution이 "이 Execution의 현재 활성 턴"
    자리를 놓고 순차 경합하는 시나리오가 이론상 가능해진다(데이터 손상보다는
    이벤트/소유권 모호성 위험에 가깝다).
  - 제안: 한 Execution에 동시에 2개 이상의 재시도 가능한 FAILED 멀티턴 노드가
    공존할 수 있는지(Parallel 브랜치 등) 제품 설계 차원에서 확인할 것. 가능하다면
    동시 `retry_last_turn` 통합/e2e 테스트를 추가하고, 애초에 불가능한 상태(예:
    Execution 레벨 FAILED는 항상 정확히 하나의 "현재" 노드 실패에서만 발생)라면
    그 불변식을 `retry-turn.service.ts`의 `retryLastTurn`/`applyRetryLastTurn`
    JSDoc이나 spec에 명시해 두는 편이 향후 회귀 방지에 도움이 된다. 이번 PR이
    새로 만든 결함이 아니라 이번 fix가 비로소 도달 가능하게 만든 사전 설계
    질문이므로 즉시 차단 사유는 아니다.

## 요약

이번 diff는 앞선 라운드가 도입한 state-machine의 `allowRetryReentry` opt-in이
`assertTransition` 레벨에서는 FAILED→RUNNING/WAITING_FOR_INPUT을 허용했음에도, 그
직후의 DB 레벨 가드(`lockNonTerminalExecutionRow` 및 `updateExecutionStatus`의 두
분기)가 `opts`를 전혀 전파하지 않아 짝 전이가 8라운드 동안 구조적으로 100% no-op
이었던 CRITICAL을 바로잡는다. `execution-engine.service.ts` /
`ai-turn-orchestrator.service.ts` / `engine-driver.interface.ts` /
`state-machine.ts` 4개 파일에 걸친 전체 호출 체인
(`retryLastTurn`→`applyRetryLastTurn`→`processAiResumeTurn`→`reparkAiResumeTurn`/
`finalizeAiNode`→`updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec`→
`lockNonTerminalExecutionRow`)을 직접 추적한 결과 opts 전파가 정합적이며, 2중 가드
(상태머신 opt-in + DB 상태 대조)가 유지돼 의도한 것보다 넓은 전이를 허용하는
부작용도 없다. 함께 수정된 테스트(특히 `mockTxManagerQuery`가 SQL·status를 실제로
대조하도록 바뀐 것)는 8라운드 동안 이 결함을 은폐했던 vacuous mock을 구조적으로
제거했으며, 관련 unit 테스트 591개(state-machine 110 + execution-engine.service
438 + retry-turn.service 43)를 직접 실행해 전부 통과함을 확인했다. 새로 발견된
결함은 없으나, (1) `finalizeAiNode` RUNNING 유지 분기의 opts 전달은 retry 재진입
경로에서 현재 도달 불가능한 무해한 코드이고, (2) 이 fix가 비로소 "활성화"하는
형제 FAILED 멀티턴 노드의 동시 재진입 시나리오는 데이터 손상 위험은 낮지만 소유권
모호성 관점에서 스코프 확인이 권고된다.

## 위험도

LOW
