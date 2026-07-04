# 동시성(Concurrency) 리뷰 — PR3 크래시/재시작 RUNNING 세그먼트 re-drive

대상: `execution-engine.service.ts` (`recoverStuckExecutions` → `reclaimStuckRunningExecution` →
`redriveStuckExecution` → `driveStuckRedrive`), 관련 스펙/테스트/e2e/controller 변경.

## 발견사항

- **[WARNING]** false-positive stale 감지 시 "FAILED 마킹" → "능동 재구동"으로 위험 성격이 바뀜 (진행 중인 실행과 이중 실행 가능성)
  - 위치: `execution-engine.service.ts:2635` `recoverStuckExecutions` / `reclaimStuckRunningExecution`(:2690) / `runNodeDispatchLoop`(:1396, `skipExecutedNodes` 가드 :1436)
  - 상세: stale 판정은 여전히 `Execution.startedAt`(실행 시작 시각, 최초 1회 기록 후 heartbeat 로 갱신되지 않음) 기준 `< now() - 30분` 이다. 이 필드는 노드별 진행 상황과 무관하므로, 단일 노드(예: 장시간 AI 호출·대용량 코드 노드·외부 API 대기)가 30분을 넘기면 워커가 실제로는 살아있고 정상 처리 중이어도 "stale" 로 오판될 수 있다(pre-existing 조건, 변경 전 코드도 동일 threshold 사용). 변경 전에는 이 오판의 결과가 "FAILED 로 마킹"(데이터 유실이지만 이중 실행은 없음)이었으나, 본 PR 이후에는 `reclaimStuckRunningExecution` 이 `started_at` 을 갱신해 소유권을 재점유한 뒤 `redriveStuckExecution` 이 **같은 그래프를 처음부터(pointer=0) 다시 forward** 시킨다. `runNodeDispatchLoop` 의 `skipExecutedNodes` 가드는 순수 in-memory `context._executedNodes`(rehydrate 시 DB 의 완료 NodeExecution 기준으로 재구성)만 참조하며, "지금 이 순간 다른 프로세스가 이 노드를 실제로 실행 중인지"를 판별하는 노드 단위 claim/lock 이 없다. 즉 오판된 stale row 에 대해 원래 워커가 여전히 노드를 실행 중이라면, 그 노드(및 이후 노드)가 두 프로세스에 의해 동시에 실행될 수 있다 — 특히 side-effect 가 있는 Integration 노드에서는 중복 외부 호출로 이어진다.
  - 근거: `reclaimStuckRunningExecution` 은 affected 기반 원자 claim 으로 "동일 recovery 스캔 간" 이중 재구동은 확실히 차단하지만(§1.3 패턴 일반화, 정상 설계), "recovery 스캔 vs 원래 살아있는 워커" 사이의 경쟁은 이 claim 매커니즘의 방어 범위 밖이다. 그리고 recovery 는 `onApplicationBootstrap` 에서만 실행되므로 트리거 자체는 드물지만, 다중 인스턴스 환경에서 한 인스턴스가 방금 재부팅했고 다른 인스턴스가 30분 넘게 같은 execution 을 실제로 처리 중인 시나리오는 배제되지 않는다.
  - 제안: (a) 최소한 스펙/코드 주석에 이 residual 위험을 명시(현재 plan/spec draft 는 "재구동 setup 실패"·"완료 노드 재실행 없음"만 다루고 "아직 살아있는 세그먼트를 잘못 stale 판정"하는 경우의 이중 실행 가능성은 명시적으로 언급 안 됨). (b) 가능하면 heartbeat 컬럼(주기적 갱신) 도입으로 false-positive 자체를 줄이거나, (c) 노드 실행 시작 시 `NodeExecution` 을 조건부 claim(예: `status='pending'→'running'` guarded UPDATE, `claimResumeEntry` 패턴 재사용)해 두 프로세스가 같은 노드를 동시에 실행 못 하게 하는 것을 PR4 범위로 명시적으로 트래킹할 것을 권고.

- **[INFO]** fire-and-forget re-drive — `recoverStuckExecutions` 가 각 `redriveStuckExecution` 을 await 하지 않고 boot을 반환
  - 위치: `execution-engine.service.ts:2661-2670` (`for (const executionId of reclaimedIds) { void this.redriveStuckExecution(executionId).catch(...) }`)
  - 상세: 의도된 설계("부팅을 그래프 실행으로 막지 않는다")이며 `.catch` 로 unhandled rejection 은 방어되어 있다. `redriveStuckExecution` 내부도 try/catch/finally 로 모든 예외 경로를 in-band 단말 처리(`markExecutionCancelled`/`finalizeResumedExecutionOutcome`)하므로 reject 자체가 사실상 발생하지 않게 설계됐다 — `.catch` 는 방어적 이중 안전장치로 적절하다.
  - 제안: 없음(설계 의도대로 안전). 다만 `finally` 블록에서 lock 을 곧바로 해제하는 점(`recoverStuckExecutions` 의 `finally`)과 `redriveStuckExecution` 들이 아직 실행 중인 상태로 lock 이 풀리는 점은 주석에서 "row 가 이미 `started_at` 갱신됐으니 재-picking 안전"이라고 명시적으로 정당화되어 있어 문제 없음.

- **[INFO]** `redriveStuckExecution` 의 조기 skip 경로(status≠RUNNING)에서 `finalizeRehydrationCleanup` 미호출
  - 위치: `execution-engine.service.ts` `redriveStuckExecution` 시작부 — `if (!savedExecution || savedExecution.status !== ExecutionStatus.RUNNING) { ...; return; }`
  - 상세: 이 경로는 rehydrate 이전이라 `contextService`/`llmDefaultConfigCache` 에 아직 아무 것도 등록되지 않았을 가능성이 높아(해당 executionId 로 rehydrate 자체를 시작 안 함) cleanup 누락이 실질적 leak 으로 이어질 가능성은 낮다. 다만 재점유 이후 동시 cancel 등으로 status 가 바뀐 경우, 혹시 이전 세션(case A 등)에서 만든 live context 가 남아있다면 정리되지 않는다.
  - 제안: 현재 위험은 낮음(low-probability, 실질 영향 미미)이나, 방어적으로 skip 분기에서도 `finalizeRehydrationCleanup(executionId)` 호출을 추가해 일관성을 높이는 것을 고려.

- **[INFO]** boot-lock(`exec:recover:lock`) 과 row-claim(`reclaimStuckRunningExecution`)의 2-layer 방어 — 설계 적절
  - 위치: `execution-engine.service.ts:2635-2644`(boot-lock, `continuationBus.acquireLock`/`releaseLock`, SET NX 60초 TTL) + `:2690-2710`(row-claim, `started_at` 조건부 UPDATE…RETURNING)
  - 상세: 두 인스턴스가 동시에 `onApplicationBootstrap` 을 타도 `acquireLock` 이 하나만 통과시키고, 설령 lock 이 만료된 채로 스캔이 겹쳐도(두 번째 boot 이 늦게 스캔 시작) row-claim 의 `affected=1` 조건이 최종 결정자라 같은 row 가 두 번 re-drive 되지 않는다. `recordRunningSegmentStart` 를 `reclaimStuckRunningExecution` 내부에서 재점유된 id 마다 호출해 `claimResumeEntry` 와 동일한 §8 active-running 세그먼트 tracking 패턴을 공유한다 — drift 없이 일관됨. 데드락 가능성 없음(단일 락 종류, TTL 존재, try/finally 로 항상 release).
  - 제안: 없음(정상). 검증 포인트로 기록.

- **[INFO]** `updateExecutionStatus` else-분기 guarded UPDATE 로 `driveStuckRedrive` 의 COMPLETED 전이가 동시 cancel 과 안전하게 상호작용
  - 위치: `execution-engine.service.ts:7121-7195` (`status IN ('pending','running','waiting_for_input')` 가드), `driveStuckRedrive` 의 `updateExecutionStatus(savedExecution, ExecutionStatus.COMPLETED)` 호출부
  - 상세: 재구동 도중 사용자가 별도 API 로 execution 을 cancel 하는 등 DB 가 이미 terminal 로 바뀐 경우, guarded UPDATE 가 0행 매칭해 `completed=false` 를 반환하고 호출부가 `EXECUTION_COMPLETED` emit 을 skip 한다(이중 terminal emit/전복 방지, M-3 패턴 재사용). 정상적으로 원자성이 보장됨.
  - 제안: 없음.

- **[INFO]** `redriveStuckExecution` pre-check(rehydrate/loadAndBuildGraph) 실패 시 처리 — 원자성 및 lock 해제 경로 확인
  - 위치: `execution-engine.service.ts` `redriveStuckExecution` catch 블록 — `RehydrationError` 분기 vs 일반 오류 분기, 둘 다 `markExecutionCancelled` 호출 후 `finalizeRehydrationCleanup` 선행.
  - 상세: `markExecutionCancelled` 자체가 `status IN (WAITING_FOR_INPUT, RUNNING)` 가드 + affected=0 처리(idempotent) + emit 실패를 별도 try/catch 로 격리해 두어 부분 실패가 상태 불일치로 이어지지 않는다. `recoverStuckExecutions` 의 boot-lock `finally` 는 이 개별 redrive 완료를 기다리지 않고 즉시 lock 을 해제하므로, redrive 도중 오류가 나도 lock 이 계속 점유되는 lock-leak 은 없다.
  - 제안: 없음.

- **[INFO]** e2e/unit 테스트가 새 semantics(re-claim, redrive, skipExecutedNodes)를 충실히 커버
  - 위치: `execution-engine.service.spec.ts` (re-claim affected 반영, 0건 skip, WAITING_FOR_INPUT 배제 가드, DB 오류 시 lock 해제, redriveStuckExecution 3분기), `test/execution-crash-redrive.e2e-spec.ts`(실제 DB 상태 조작으로 크래시 합성 후 재구동 검증, 완료 노드 미재실행 카운트 검증).
  - 상세: 동시성 관련 회귀(WAITING_FOR_INPUT 오염, lock 누수, 완료 노드 재실행)에 대한 가드가 충분히 있다. 다만 "오판된 stale(실제로 아직 살아있는 워커)에 대한 이중 실행" 시나리오는 unit/e2e 어느 쪽에도 커버되지 않는다(위 WARNING 항목 참고) — 이는 재현이 어려운 시나리오라 테스트 부재 자체가 심각한 결함은 아니다.
  - 제안: 없음(정보 제공).

## 요약

이번 변경(PR3)은 `recoverStuckExecutions` 를 "stale RUNNING 일괄 FAILED 마킹"에서 "`started_at` 조건부 원자 re-claim + rehydration 재구동"으로 전환한다. re-claim 은 `affected` 기반 조건부 UPDATE 로 "동일 스캔 내 이중 소유"를 기계적으로 차단하고(§1.3 패턴의 정당한 일반화), boot-lock(SET NX)과 row-claim 의 2-layer 방어가 서로 견고히 보완되어 데드락·락 누수 없이 잘 설계됐다. `finalizeRehydrationCleanup`/`markExecutionCancelled`/`updateExecutionStatus` 의 guarded UPDATE 들도 동시 cancel 과의 경쟁에서 idempotent 하게 동작한다. 다만 stale 판정 기준(`startedAt` 30분, heartbeat 미갱신)은 변경 전부터 존재한 pre-existing 한계인데, 이번 변경으로 그 오판의 **결과**가 "정지(FAILED)"에서 "능동 재실행"으로 바뀌면서, 노드 단위 실행 중(in-flight) claim 이 없는 상태에서 진짜로 아직 살아있는 세그먼트를 재구동할 경우 이중 실행(특히 side-effect 있는 Integration 노드) 위험이 새로 생겼다. 이 잠재 경쟁은 발생 확률이 낮고(30분 초과 + 재부팅 타이밍이 겹쳐야 함) 재구동 자체의 원자성/멱등 설계(재-claim·skipExecutedNodes·guarded terminal 전이)는 견고하므로 CRITICAL 로 보지는 않으나, WARNING 으로 명시해 스펙 문서(§7.3/§7.5 Rationale)에 residual 위험으로 남기거나 후속 PR4 에서 노드 단위 claim 도입을 검토할 것을 권고한다.

## 위험도

MEDIUM
