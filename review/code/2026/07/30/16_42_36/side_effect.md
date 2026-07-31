# 부작용(Side Effect) 리뷰

리뷰 대상 (5 파일, 전체 파일 컨텍스트 기준):
- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`

핵심 변경(8R CRITICAL, 커밋 `2ca44b769`): `execution.retry_last_turn` 재진입이 의존하는
FAILED→RUNNING / FAILED→WAITING_FOR_INPUT 짝 전이가 상태머신(`allowRetryReentry` opt-in)은
통과하지만 DB 가드(`lockNonTerminalExecutionRow` FOR UPDATE 조회 + `updateExecutionStatus`
else 분기 guarded UPDATE)에는 그 opt-in 이 전파되지 않아 항상 0행이었던 결함의 수정.
직후 커밋(9R, `1838c6fec`)은 이 5 파일을 건드리지 않고 회귀 테스트(`execution-engine.service.spec.ts`)
와 spec 문서만 갱신했으므로, 이 5 파일의 코드 내용은 8R 커밋 이후 변경이 없다(직접 `git diff`/`Read`
로 확인).

## 발견사항

- **[INFO]** 이번 변경의 시그니처 확장 5건은 전부 "끝에 붙는 선택적 파라미터"이며 기존 호출부와 호환된다
  - 위치: `state/state-machine.ts:63`(`canTransition`)·`:95`(`assertTransition`, 기존 `opts?: TransitionOptions` 자체는 유지, 넓어진 건 내부 판정 로직 `:72-77`) / `engine-driver.interface.ts:213`(`AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec` 신규 `opts` 파라미터) / `execution-engine.service.ts:8171`(`lockNonTerminalExecutionRow`, private)·`:8233`(`tryLockActiveExecutionAndSaveNodeExec`, public) / `ai-turn-orchestrator.service.ts:442`(`reparkAiResumeTurn`, private)·`:1437`(`finalizeAiNode`, private — 기존 `opts` 파라미터 자체는 유지, 넓어진 건 `allowRetryReentry` 전파 대상)
  - 상세: `tryLockActiveExecutionAndSaveNodeExec` 만 `public`(`AiTurnEngineDriver` 인터페이스 멤버)이고 나머지는 전부 `private`. 인터페이스와 구현체가 같은 라운드에서 함께 갱신돼 drift 없음을 `engine-driver.interface.ts:210-214` ↔ `execution-engine.service.ts:8224-8234` 대조로 확인했다. 저장소 전체 grep 결과 `tryLockActiveExecutionAndSaveNodeExec` 의 실제 호출부는 `ai-turn-orchestrator.service.ts` 2곳(`:1505`, `:1597`)뿐이라 `ENGINE_DRIVER` DI 경계 밖 소비자 영향 없음. `EngineDriver` 의 유일한 구현체는 `ExecutionEngineService`(`useExisting` 바인딩) 하나뿐이라 다중 구현체 간 시그니처 불일치 위험도 없다.
  - 제안: 없음.

- **[INFO]** DB 행 잠금(FOR UPDATE) 대상을 FAILED 까지 넓히는 opt-in 이 저장소 전체에서 단일 발화점으로 수렴함을 재확인
  - 위치: 발화점 `retry-turn.service.ts:466`(`processAiResumeTurn(..., { retryReentry: true })`) — `applyRetryLastTurn` 내부. 전파 경로: `ai-turn-orchestrator.service.ts:223-225`(`processAiResumeTurn` 의 `finalizeOpts` 파생) → `:237-243`/`:303-309`/`:321-327`/`:339-344`(`reparkAiResumeTurn` 4개 호출부, 전부 `finalizeOpts` 전달) 및 `:251-259`/`:279-287`/`:291-299`(`finalizeAiNode` 3개 호출부, 전부 `finalizeOpts` 전달) → `:1439`(`allowRetryReentry = opts?.retryReentry === true`) → `:1508`/`:1600`/`:1619`(`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` 호출 시 조건부 `{ allowRetryReentry: true }`) → `execution-engine.service.ts:8420`/`:8459-8461`(`lockNonTerminalExecutionRow` 호출·`elseStatusesSql` 선택).
  - 상세: `grep -rn "retryReentry: true|allowRetryReentry: true"` (테스트 제외) 로 저장소 전체를 재확인한 결과 리터럴 `true` 는 `retry-turn.service.ts:466` 딱 한 곳에만 등장하고, 그 외 전부 `opts?.retryReentry`/`allowRetryReentry` 지역 변수를 조건으로 삼는 삼항식이다. `handleAiResumeTurn`(§7.5 일반 rehydration, `ai-turn-orchestrator.service.ts:100`)은 `processAiResumeTurn` 8번째 인자를 아예 전달하지 않아 `opts=undefined` → `finalizeOpts=undefined` → 일반 재개 경로는 opt-in 없이 그대로 유지된다. Form/Button interaction 서비스(`form-interaction.service.ts:110,325`, `button-interaction.service.ts:395,567`)의 `updateExecutionStatus` 호출도 4번째 인자를 전달하지 않아 영향 밖이다.
  - 제안: 없음 — 의도한 opt-in 격리가 실제로 단일 경로임을 재확인.

- **[INFO]** 새 정적 필드 `NON_TERMINAL_OR_FAILED_STATUSES_SQL` — 클래스 로드 시 1회 계산, opt-in 상태에서도 COMPLETED/CANCELLED 는 여전히 배제
  - 위치: `execution-engine.service.ts:520-543`
  - 상세: 형제 상수 `NON_TERMINAL_STATUSES_SQL`(WARNING #8, 2026-07-26)과 동일하게 `Object.values(ExecutionStatus)` 기반 filter+map+join 이 클래스 정의 시점에 1회만 평가되고 호출마다 재계산되지 않는다. enum 값만 사용하므로 SQL 인젝션 경로 없음. 실제로 이 상수가 생성하는 값은 `'pending', 'running', 'failed', 'waiting_for_input'` 이라, opt-in 이 켜져도 "동시 COMPLETED/CANCELLED 선점" 에 대한 기존 방어(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` else 분기 guarded UPDATE)는 그대로 유지된다.
  - 제안: 없음.

- **[INFO]** `emitTerminalExecutionMetrics` 는 이번에 새로 도달 가능해진 FAILED→RUNNING/WAITING_FOR_INPUT 전이에서 발화하지 않음 — 신규 메트릭/이벤트 부작용 없음
  - 위치: `execution-engine.service.ts:8439`(linkedNodeExec 분기 호출)·`:8494`(else 분기 호출)·`:8505-8521`(구현, `:8511` `if (!TERMINAL_STATUSES.has(newStatus)) return;`)
  - 상세: `TERMINAL_STATUSES` 는 COMPLETED/FAILED/CANCELLED 만 포함(`:499-503`). 이번 fix 로 실제 persist 되게 된 두 전이의 `newStatus` 는 각각 RUNNING(즉시 종료)과 WAITING_FOR_INPUT(re-park) — 둘 다 non-terminal 이므로 이 가드에서 조기 반환해 `recordExecutionTerminal`/`recordExecutionError`/`recordNodeLatencyMetrics` 어느 것도 새로 발화하지 않는다.
  - 제안: 없음.

- **[INFO]** retry 재진입의 "턴 계속(re-park)" 분기는 RUNNING 을 거치지 않고 FAILED→WAITING_FOR_INPUT 으로 직행 — 그 턴에 한해 §8 `segmentStartMs` 활성시간 회계가 시작되지 않음
  - 위치: `ai-turn-orchestrator.service.ts:452-458`(`reparkAiResumeTurn` → `updateExecutionStatus(savedExecution, WAITING_FOR_INPUT, ...)`) / `execution-engine.service.ts:8375-8376`(`enteringRunning = newStatus === RUNNING && ...`)·`:8436-8438`(`if (enteringRunning && persisted) recordRunningSegmentStart`)
  - 상세: 수정 전에는 이 전이 자체가 `assertTransition` 동기 throw 로 도달 불가능했다(버그가 이 경로를 차단). 수정 후 실제로 FAILED→WAITING_FOR_INPUT 이 직접 일어나므로 `enteringRunning`(`newStatus===RUNNING` 조건)이 false 가 되어 `recordRunningSegmentStart` 가 호출되지 않는다 — 이 재개 턴의 LLM 처리 시간이 §8 `activeRunningMs` 누적 타임아웃 예산에 계측되지 않는다(과소계상). 같은 클래스 필드의 기존 문서화 방침("Graceful Shutdown 아래 under-count 허용(W4) — over-count 보다 덜 위험", `:562-568` JSDoc)과 같은 방향이고, 다음 턴부터는 정상 §7.5 재개(`claimResumeEntry`, WAITING_FOR_INPUT→RUNNING)가 회계를 재개하므로 영향은 retry 재진입 직후 첫 continuation 턴 1회로 국한된다. "턴이 즉시 종료"하는 분기(`finalizeAiNode` COMPLETED, `:1596-1601`/`:1615-1620`)는 FAILED→RUNNING 직행이라 `enteringRunning=true` 로 정상 계측됨을 별도로 확인했다.
  - 제안: 이번 CRITICAL fix 의 필수 범위는 아니라고 판단하나, §8 활성시간 정확도가 중요하면 `reparkAiResumeTurn` 이 retry-reentry 경로(FAILED 출발)일 때 한정해 세그먼트 시작 시각을 별도 기록하는 후속을 검토할 수 있다(정보 제공 목적).

- **[INFO]** `retry-turn.service.ts` 자체는 이번 8R/9R 라운드에서 미변경 — 과거 회귀(NODE_STARTED payload)는 이미 해소 확인
  - 위치: `retry-turn.service.ts:369`(`delete spawnedRow.inputData[RETRY_STATE_KEY]`)·`:444-449`(`emitNode(NODE_STARTED, { ..., input: spawnedRow.inputData, ... })` 직전 주석 "W6(ai-review 7R) — `_retryState` 는 위 claim 직후 delete 로 이미 제거됨(internal 필드 비노출 의도, 회귀 테스트로 잠금)")
  - 상세: 이전 라운드(`review/code/2026/07/30/11_41_20`)가 이 delete 로 인해 `NODE_STARTED` WS 이벤트의 `input` payload 가 조용히 `{}` 로 바뀌는 부수효과를 WARNING 으로 지적했었는데, 이후 커밋(`886ca9395` 회귀 테스트 추가, `7a05c6ec8` JSDoc 정정)에서 그 제안(테스트 잠금 + 주석 명시)이 그대로 반영돼 현재는 코드 주석과 회귀 테스트 양쪽에 이 의도가 명시돼 있다. 이번 리뷰 대상 diff(8R/9R)는 이 파일을 건드리지 않았으므로 새 발견 없음.
  - 제안: 없음 — 이미 해소됨, 재-flag 아님.

## 확인했으나 새 결함 아님 (참고)

- `lockNonTerminalExecutionRow`(private) 호출부는 `execution-engine.service.ts` 안에 정확히 2곳(`:8237` linkedNodeExec 분기 대칭 헬퍼, `:8420` `updateExecutionStatus` linkedNodeExec 분기)뿐이며 둘 다 `opts` 를 그대로 전달한다 — 세 번째 호출부가 몰래 opts 를 누락하는 경로는 없다.
- `updateExecutionStatus` 의 기존(비-retry) 호출부 전수(`execution-engine.service.ts` 내부 9곳, `form-interaction.service.ts` 2곳, `button-interaction.service.ts` 2곳, `retry-turn.service.ts:667,888`)를 grep 으로 대조한 결과 전부 4번째 `opts` 인자를 생략해 기존 동작(FAILED 배제)을 그대로 유지한다 — 이번 변경이 의도치 않게 다른 종결/park 경로의 방어를 느슨하게 만들지 않는다.
- `finalizeGuarded`(`retry-turn.service.ts:573-)`)의 "FAILED→FAILED 자기 전이" 처리(`:579-589` DB 재조회 후 `live.status===target` 분기)는 이번 diff 대상 밖(2R~4R 라운드 기존 코드)이며 재진입이 즉시 재실패하는 경우를 이미 올바르게 처리하고 있음을 확인했다 — 이번 opt-in 확장과 상호작용해도 회귀 없음.
- 환경 변수 읽기/쓰기, 신규 파일시스템 부작용, 의도치 않은 외부 네트워크 호출은 5개 파일 전체에서 발견되지 않았다.

## 요약

이번 변경(8R CRITICAL, `2ca44b769`)은 retry 재진입 짝 전이의 `allowRetryReentry` opt-in 이 in-memory 상태머신은 통과하되 DB 행 잠금 가드에는 전달되지 않아 구조적으로 0행이었던 결함을, 신규 정적 SQL 상수(`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)와 5건의 후미-선택적 파라미터 전파로 고친다. 시그니처 변경은 전부 기존 호출부와 호환되고(인터페이스·구현체 동시 갱신, 유일한 구현체 확인 완료), opt-in 이 `true` 로 세팅되는 지점은 저장소 전체에서 `retry-turn.service.ts` 한 곳으로 수렴해 일반 실행 경로("실패 종결 실행의 우발적 부활 차단")에는 회귀가 없다. opt-in 상태에서도 COMPLETED/CANCELLED 는 여전히 배제되고, 새로 도달 가능해진 non-terminal 전이는 terminal-전용 메트릭 발화 경로를 타지 않는다. 유일하게 실질적인(그러나 이미 코드베이스가 명시적으로 감내해 온 방향의) 부수효과는 retry 재진입의 "턴 계속" 분기가 RUNNING 을 거치지 않고 FAILED→WAITING_FOR_INPUT 으로 직행해 그 턴 1회에 한해 §8 활성-실행시간 회계가 시작되지 않는다는 점이다. `retry-turn.service.ts` 는 이번 두 커밋에서 미변경이며, 그 파일의 과거 부수효과(NODE_STARTED payload 변화)는 이미 후속 커밋에서 테스트·문서로 해소됐음을 확인했다. 전역 변수 오염, 파일시스템 부작용, 의도치 않은 네트워크 호출은 발견되지 않았다.

## 위험도

LOW
