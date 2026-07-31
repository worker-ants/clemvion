# 부작용(Side Effect) 리뷰

대상: `execution.retry_last_turn` 재진입 짝 전이 DB 가드 결함 수정 (8R CRITICAL fix, 커밋 `2ca44b769`)
- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` (컨텍스트, 이번 커밋 미변경)

## 발견사항

- **[INFO]** `tryLockActiveExecutionAndSaveNodeExec` 공개 메서드 시그니처에 3번째 선택적 파라미터(`opts?: { allowRetryReentry?: boolean }`) 추가
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8224`(구현), `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`(`AiTurnEngineDriver.tryLockActiveExecutionAndSaveNodeExec`, 프롬프트 게이트 210-214)
  - 상세: 옵션 파라미터를 끝에 추가하는 형태라 기존 2-인자 호출과 완전 호환된다. 인터페이스(`AiTurnEngineDriver`)가 같은 커밋에서 동일하게 갱신돼 구현체와 어긋나지 않음을 확인했다. 이 메서드는 `ENGINE_DRIVER` DI 토큰을 경유해서만 주입되고 구현체는 `ExecutionEngineService` 단일(문서화된 설계)이며, 저장소 전체 grep 결과 실제 호출부는 `ai-turn-orchestrator.service.ts` 2곳(소스 라인 1505, 1597 부근)뿐이라 이 인터페이스 밖의 외부 소비자에게 영향이 없다.
  - 제안: 없음 — 이미 안전하게 반영됨.

- **[INFO]** private 메서드 2건(`lockNonTerminalExecutionRow`, `reparkAiResumeTurn`) 시그니처 확장 — 호출부 전수 갱신 확인
  - 위치: `lockNonTerminalExecutionRow` (`execution-engine.service.ts:8168`, 호출부 8237·8420 둘 다 `opts` 전달), `reparkAiResumeTurn` (`ai-turn-orchestrator.service.ts`, 프롬프트 게이트 430/442 파라미터 정의, 호출부 4곳 — 프롬프트 게이트 237/303/321/339 — 전부 `finalizeOpts` 인자로 갱신됨)
  - 상세: 둘 다 `private` 라 클래스 경계 밖 영향이 없고, 신규 파라미터가 항상 마지막 선택적 인자라 시그니처 파괴적 변경이 아니다. 두 메서드 모두 grep 으로 재확인한 결과 옛 시그니처로 남아있는 호출부는 없었다.
  - 제안: 없음.

- **[INFO]** 신규 `private static readonly NON_TERMINAL_OR_FAILED_STATUSES_SQL` 필드 — 클래스 로드 시 1회만 계산, 런타임 부작용 없음
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, 프롬프트 게이트 534-543
  - 상세: `Object.values(ExecutionStatus)` 기반 filter+map+join 은 클래스 정의 시점에 한 번만 평가되며(형제 상수 `NON_TERMINAL_STATUSES_SQL`, WARNING #8 2026-07-26 과 동일 패턴) 호출마다 재계산되지 않는다. 고정 enum 값 기반이라 SQL 인젝션 경로도 없다. 실제 값을 계산해보면 `'pending', 'running', 'failed', 'waiting_for_input'` 로, COMPLETED/CANCELLED 는 여전히 배제된다 — 즉 opt-in 상태에서도 "진짜 동시 취소/완료"에 대한 기존 방어는 그대로 유지된다.
  - 제안: 없음.

- **[INFO]** 상태머신 opt-in 확장(FAILED→WAITING_FOR_INPUT)은 저장소 전체에서 단일 출처로만 트리거됨 — 일반 실행 경로에 회귀 없음
  - 위치: `state-machine.ts` 게이트 63-83(`canTransition`), TransitionOptions 게이트 45-58; 트리거 출처 `retry-turn.service.ts` 게이트 466(`{ retryReentry: true }`)
  - 상세: `grep -rn "allowRetryReentry: true"` 로 저장소 전체를 확인한 결과 4개 호출부 모두 `ai-turn-orchestrator.service.ts` 안에서 지역 변수(`opts?.retryReentry` / `allowRetryReentry`) 조건부로만 세팅되고, 그 지역 변수의 유일한 `true` 출처는 `RetryTurnService.applyRetryLastTurn` → `processAiResumeTurn(..., { retryReentry: true })` 한 곳뿐이다(다른 호출부인 `handleAiResumeTurn` → `processAiResumeTurn`(§7.5 일반 rehydration)는 8번째 인자를 아예 전달하지 않아 opts=`undefined`). 일반(비-retry) 실행 경로는 opts 가 항상 `undefined`로 남아 "FAILED 종결 실행의 우발적 부활 차단" 기존 방어가 그대로 유지된다.
  - 제안: 없음 — 의도한 opt-in 격리가 실제로 단일 경로임을 확인.

- **[INFO]** retry 재진입 "턴 계속" 분기는 FAILED→WAITING_FOR_INPUT 로 직행 — RUNNING 세그먼트 회계(`segmentStartMs`)가 이 턴에 대해 시작되지 않음 (이번 fix 로 새로 도달 가능해진 경로)
  - 위치: `ai-turn-orchestrator.service.ts`(`reparkAiResumeTurn`, 프롬프트 게이트 453-458 — `updateExecutionStatus(savedExecution, ExecutionStatus.WAITING_FOR_INPUT, ...)`); `execution-engine.service.ts`(`updateExecutionStatus` 의 `enteringRunning` 계산, 실제 소스 라인 8375-8376, `newStatus === ExecutionStatus.RUNNING`)
  - 상세: 수정 전에는 이 전이가 `assertTransition`에서 동기 throw 했으므로 이 지점에 도달하지 못했다(버그 자체가 이 경로를 차단하고 있었음). 수정 후에는 Execution 이 FAILED→WAITING_FOR_INPUT 으로 직접 전이하며 중간에 RUNNING 을 거치지 않으므로, `updateExecutionStatus` 의 `enteringRunning`(`newStatus===RUNNING` 조건)이 false 가 되어 `recordRunningSegmentStart` 가 호출되지 않는다 — 이 재개 턴의 처리 시간(LLM 호출 등)이 §8 `activeRunningMs` 누적 타임아웃 예산에 계측되지 않는다. 다만 이는 같은 클래스 필드의 기존 문서화된 방침("Graceful Shutdown 아래 under-count 허용(W4 명시) — over-count 보다 덜 위험" `segmentStartMs` JSDoc)과 같은 방향(과소계상)이며, 다음 턴부터는 정상 §7.5 재개(`claimResumeEntry`, WAITING_FOR_INPUT→RUNNING)를 타 회계가 재개되므로 영향 범위는 retry 재진입 직후 이어지는 턴 1회로 국한된다.
  - 제안: 이번 CRITICAL fix 의 필수 스코프는 아니라고 판단하나, §8 활성시간 정확도가 중요하다면 `reparkAiResumeTurn` 이 retry-reentry 경로일 때 한정해 세그먼트 시작 시각을 별도로 기록하는 후속 검토를 고려할 수 있다(정보 제공 목적, 즉시 조치 요구 아님).

## 요약

이번 변경은 `allowRetryReentry` opt-in 이 in-memory 상태머신은 통과하되 DB 가드(`lockNonTerminalExecutionRow`/`tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` else 분기)에는 전혀 전달되지 않아 짝 전이가 구조적으로 0행이었던 결함을 고치는 fix로, 시그니처 변경 3건(1개 public, 2개 private)이 모두 끝에 붙는 선택적 파라미터라 기존 호출부와 완전히 호환되고, 인터페이스(`AiTurnEngineDriver`)도 동일 커밋에서 함께 갱신돼 드리프트가 없다. 새로 추가된 정적 SQL 상수는 클래스 로드 시 1회만 계산되는 enum 기반 값이라 런타임 부작용·인젝션 위험이 없고, 여전히 COMPLETED/CANCELLED 를 배제해 기존 동시-취소 방어를 보존한다. `allowRetryReentry`/`retryReentry` 플래그가 `true` 로 세팅되는 지점은 저장소 전체에서 `RetryTurnService.applyRetryLastTurn` 단 한 곳으로 추적되며, 일반 실행 경로는 opts 가 항상 `undefined` 로 남아 "실패 종결 실행의 우발적 부활 차단" 이라는 기존 안전장치가 그대로 유지된다. 유일하게 언급할 만한 부수 효과는 retry 재진입의 "턴 계속" 분기가 FAILED→WAITING_FOR_INPUT 으로 직행해 §8 활성-실행시간 세그먼트 회계가 그 턴에 대해서만 시작되지 않는다는 점인데, 이는 코드베이스가 이미 명시적으로 허용해 온 under-count 방향과 일치하고 영향 범위도 1턴으로 국한돼 이번 리뷰에서는 정보성으로만 기록한다. 환경 변수 읽기/쓰기, 신규 전역 변수, 파일시스템 부작용, 의도치 않은 네트워크 호출은 발견되지 않았고, 이벤트 emit 경로(`emitTerminalExecutionMetrics`)도 terminal 상태 가드가 그대로 유지돼 이번 변경으로 새로 발화하는 메트릭/이벤트가 없음을 확인했다.

## 위험도
LOW
