STATUS=success side_effect review complete — 0 CRITICAL, 0 WARNING, 2 INFO
===REPORT_MARKDOWN_BELOW===
# 부작용(Side Effect) 리뷰 — retry_last_turn 짝 전이 DB 가드 opts 배선 (8R~10R 누적, main 대비)

리뷰 대상(`change_type: Review`, 전체 파일 컨텍스트 제공, `main` 대비 실제 diff 로 대조):

- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`

`main` 대비 이 5개 파일의 실제 동작 변경은 8R 커밋(`2ca44b769`) 1개로 귀결된다. 9R(`1838c6fec`)·10R(`3c306d593`)
은 테스트·spec·JSDoc 만 추가했고 이 5개 파일 중 소스 로직을 바꾼 곳은 없다(10R 은 `engine-driver.interface.ts`
JSDoc 7줄만 추가). 이 리뷰는 8R 이 도입한 `opts.allowRetryReentry` 배선을 전체 호출부까지 추적해 부작용을
검증했다.

## 발견사항

없음 (CRITICAL/WARNING 없음).

## 확인했으나 새 결함 아님 (참고)

- **[INFO]** `updateExecutionStatus` 의 신규 4번째 인자 `opts`(및 `tryLockActiveExecutionAndSaveNodeExec`
  의 신규 3번째 인자 `opts`)는 둘 다 **optional**이고, 기존 호출부(비-retry 경로)는 전부 이 인자를
  넘기지 않는다 — 시그니처 확장이 기존 호출자에게 영향을 주지 않는다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8358`
    (`updateExecutionStatus` 시그니처), `:8233`(`tryLockActiveExecutionAndSaveNodeExec` 시그니처).
  - 상세: `updateExecutionStatus` 의 호출부 13곳(`failFirstSegmentSetup`, `executeSync` timeout,
    top-level COMPLETED 종결 4곳, RUNNING 페어링 진입 2곳, `finalizeCancelledExecution`,
    `finalizeFailedExecution` 등)을 전수 확인한 결과 `opts` 를 넘기는 곳은
    `ai-turn-orchestrator.service.ts` 의 `finalizeAiNode`(else 분기, `:1615`)와
    `reparkAiResumeTurn`(`:453`) 단 2곳뿐이다. 나머지 11곳은 `opts` 가 `undefined` 이므로
    `opts?.allowRetryReentry` 는 falsy → `elseStatusesSql`/`statusesSql` 은 종전과 동일한
    `NON_TERMINAL_STATUSES_SQL` 을 선택해 DB 가드 동작이 diff 이전과 완전히 동일하다.
    `tryLockActiveExecutionAndSaveNodeExec` 도 소비처가 `AiTurnOrchestrator` 의 `finalizeAiNode`
    2곳(`:1505`, `:1597`)뿐임을 grep 으로 재확인했다.
  - `allowRetryReentry: true` / `retryReentry: true` 가 실제로 참이 되는 경로도 전수 추적했다 —
    유일한 발화점은 `retry-turn.service.ts:466`(`applyRetryLastTurn` 이 `processAiResumeTurn` 을
    `{ retryReentry: true }` 로 호출)이고, 이 값이 `finalizeOpts`(`ai-turn-orchestrator.service.ts:223-225`)
    → `reparkAiResumeTurn`/`finalizeAiNode` 의 `opts` → `allowRetryReentry` 리터럴로 그대로 흘러
    DB 가드까지 도달한다. 코드베이스 전체(`grep -rn allowRetryReentry\|retryReentry`, `*.spec.ts` 제외)에
    이 리터럴을 세팅하는 다른 지점은 없다 — 일반 실행 경로가 이 opt-in 을 우발적으로 켤 방법이 없다.
  - 새 정적 필드 `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(`execution-engine.service.ts:534`)은
    `ExecutionStatus` enum 값에서 파생되는 순수 계산이며 형제 상수 `NON_TERMINAL_STATUSES_SQL` 과
    동일한 class-static 패턴(클래스 로드 시 1회 평가)이라 신규 부작용 표면이 아니다. `opts.allowRetryReentry`
    가 `true` 여도 `COMPLETED`/`CANCELLED` 는 계속 배제되므로(필터 조건 `!TERMINAL_STATUSES.has(status) ||
    status === FAILED` — COMPLETED/CANCELLED 는 여전히 제외) 실제 동시 취소/정상 종결 감지는 그대로 보존된다.
  - 환경변수·파일시스템·네트워크 호출 관련 라인 추가는 diff 전체에서 0건(`process.env`/`fs.`/`fetch`/
    `axios`/`require(` grep 전부 무매치).

- **[INFO]** 이 fix 가 이전엔 **도달 불가능하던** `segmentStartMs.set()` 코드 경로를 처음으로 실행 가능하게
  만든다 — 의도된 결과이지 결함이 아니다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8436`
    (`if (enteringRunning && persisted) { this.recordRunningSegmentStart(execution.id); }`,
    `linkedNodeExec` 분기 내부).
  - 상세: 8R 이전에는 retry 재진입의 FAILED→RUNNING 짝 전이가 DB 가드에서 항상 0행이라 `persisted`
    가 절대 `true` 가 될 수 없었으므로, 이 분기의 `recordRunningSegmentStart` 호출은 retry 재진입
    경로에서 코드상 존재하되 실행된 적이 없는 죽은 경로였다. 이번 fix 로 `persisted===true` 가 실제로
    가능해지면서 retry 재진입 성공 시 `segmentStartMs` Map 에 처음으로 항목이 생긴다. 이는 §8
    active-running 누적(PR2a)의 문서화된 불변식("RUNNING 진입 시 세그먼트 시작 기록")과 정확히
    일치하는 의도된 활성화이고, Map 정리는 기존 3개 소거 지점(`finalizeRehydrationCleanup`,
    `runExecution` catch/finally, `executeBackgroundSubgraph` finally)이 이미 `executionId` 단위로
    커버하므로 이 fix 로 새로운 누수 표면이 생기지는 않는다. 별도 조치 불필요, 참고용 기록.

- 7R 리뷰(`review/code/2026/07/30/11_41_20/side_effect.md`)가 지적한 WARNING — `applyRetryLastTurn` 의
  `delete spawnedRow.inputData[RETRY_STATE_KEY]` 가 `NODE_STARTED` emit 의 `input` 페이로드에서
  `_retryState` 를 조용히 제거한다는 지적 — 은 이번 라운드 이전에 이미 해소됐다: 코드 주석
  (`retry-turn.service.ts:364-368`, "W6(ai-review 7R) — 이 delete 는 아래 emitNode 의 input
  페이로드에도 영향한다 … 회귀 테스트로 잠갔다")과 실제 회귀 테스트
  (`retry-turn.service.spec.ts:745` `'NODE_STARTED emit 의 input payload 는 _retryState 를
  포함하지 않는다 (W6)'`, `:764` `expect(payload.input).not.toHaveProperty('_retryState')`)를
  직접 확인했다. 재-flag 하지 않는다.
- `engine-driver.interface.ts` 변경은 `tryLockActiveExecutionAndSaveNodeExec` 에 optional
  `opts` 파라미터 + JSDoc 추가뿐이며(`:219`), 이 인터페이스의 유일한 구현체(`ExecutionEngineService`)·
  유일한 소비처(`AiTurnOrchestrator`)와 시그니처가 정확히 대칭이다. 공개 REST/WS API(controller/gateway)
  표면은 이번 diff 에 전혀 포함되지 않았다 — 외부 클라이언트에 노출되는 인터페이스 변경 없음.
- `retry-turn.service.ts` 의 `applyRetryLastTurn` FAILED→FAILED "재실패 후 재-실패" 자기전이 케이스는
  `finalizeGuarded`(`:589-659`, 이번 diff 밖·불변)가 `canTransition`/`assertTransition` 을 아예
  거치지 않는 별도의 "이미 목표 상태" 멱등 분기로 이미 처리하고 있어, 8R 이 연 `allowRetryReentry`
  opt-in 과 충돌하지 않는다(직접 코드 대조로 확인).

## 요약

`main` 대비 이 5개 파일의 실제 동작 변화는 "retry_last_turn 재진입의 FAILED→RUNNING/WAITING_FOR_INPUT
짝 전이가 상태머신 계층(assertTransition)은 통과하고도 DB 잠금 가드(lockNonTerminalExecutionRow 및 그
2개 소비처)에서 항상 0행으로 막히던" 8R CRITICAL 결함의 수정으로 귀결되며, 이 opts 배선을 모든 호출부
(`updateExecutionStatus` 13곳, `tryLockActiveExecutionAndSaveNodeExec` 2곳)까지 전수 추적한 결과 새 동작은
`retry-turn.service.ts` 의 단일 발화점(`{ retryReentry: true }`)에서만 활성화되고 그 외 모든 일반 실행
경로는 opts 가 `undefined` 라 종전과 동일하게 동작한다 — 시그니처 확장은 100% 하위호환(optional 파라미터)
이며 공개 API·환경변수·파일시스템·네트워크 호출·전역 가변 상태 어느 축에서도 의도치 않은 부작용을 찾지
못했다. 직전 라운드(7R)가 지적했던 유일한 부작용(WARNING, `NODE_STARTED` payload 의 `_retryState` 소실)도
이미 회귀 테스트로 잠겨 해소를 확인했다. 유일하게 새로 짚을 점은 이 fix 가 이전엔 죽어있던
`segmentStartMs` 기록 경로를 처음 실행시킨다는 것인데, 이는 문서화된 설계 의도와 일치하고 기존 정리
지점으로 커버되므로 INFO 로만 기록한다.

## 위험도

NONE
