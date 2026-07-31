STATUS=success ISSUES=0
===REPORT_MARKDOWN_BELOW===
# 동시성(Concurrency) 리뷰 — `retry_last_turn` FAILED→RUNNING/WAITING_FOR_INPUT 재진입 가드 (2026-07-30 18:26:50)

## 리뷰 범위 확인

이번 라운드의 실제 diff(`git diff HEAD~1 HEAD`)는 `engine-driver.interface.ts` 의
`updateExecutionStatus` JSDoc 에 `@param opts.allowRetryReentry` 설명 6줄을 추가한
것뿐이다 — **런타임 로직 변경 0**. `retry-turn.service.ts`/`state-machine.ts` 는 이번
커밋에서 무변경이며, 전체 파일 컨텍스트로 함께 제공된 것은 관련 로직을 종합 재검토하라는
의도로 판단해 아래와 같이 cross-file 로 실제 구현부(`execution-engine.service.ts`,
`ai-turn-orchestrator.service.ts`)까지 추적 검증했다.

## 발견사항

- **[INFO]** 신규 JSDoc 이 실제 구현과 정확히 일치함을 대조 검증
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:76-83`
    (`updateExecutionStatus` JSDoc), 대조 대상 구현은
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `lockNonTerminalExecutionRow`(8168-8184행), `updateExecutionStatus`
    (8354-8496행), 및 `NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`
    (513-543행).
  - 상세: JSDoc 이 주장하는 "상태머신 opt-in 과 DB 가드(짝 전이 FOR UPDATE 잠금 · else
    분기 guarded UPDATE) 양쪽에 함께 적용돼야 하며, 하나만 반영하면 전이가 항상 0행으로
    막힌다" 는 서술을 실제 코드로 추적한 결과 정확히 일치한다: `updateExecutionStatus` 의
    두 분기(`linkedNodeExec` 짝 전이 분기, else 단독 분기) 모두
    `opts?.allowRetryReentry` 여부에 따라 `NON_TERMINAL_OR_FAILED_STATUSES_SQL`
    (FAILED 포함) 대 `NON_TERMINAL_STATUSES_SQL`(FAILED 배제)을 선택하도록 되어
    있고, `NON_TERMINAL_OR_FAILED_STATUSES_SQL` 은 opt-in 상태에서도 COMPLETED/
    CANCELLED 를 계속 배제한다(`TERMINAL_STATUSES` 필터 + FAILED 만 추가). 호출부
    (`ai-turn-orchestrator.service.ts` 의 `reparkAiResumeTurn` L453-457,
    `finalizeAiNode` 의 isFailed 분기 L1504-1509 및 RUNNING-유지/재claim else 분기
    L1596-1620) 도 상태머신 opt-in(`state-machine.ts` 의 `canTransition`
    `allowRetryReentry` 분기, L72-79)과 DB 가드 opt-in 을 항상 짝으로 전달한다 —
    한쪽만 반영되는 경로는 발견되지 않았다.
  - 제안: 없음 (문서-구현 일치 확인).

- **[INFO]** 잔여 동시성 항목은 이미 `plan/in-progress/retry-turn-terminal-guard.md`
  에 defer 로 추적 중 — 신규 아님
  - 위치: `plan/in-progress/retry-turn-terminal-guard.md` (10R/11R 섹션, 항목
    #20·#21). 코드상 관련 지점은 `retry-turn.service.ts` 의 `retryLastTurn`
    (Execution.status 미검증, L130-252)과 `applyRetryLastTurn` 의
    `this.driver.rehydrateContext(execution, spawnedRow)` 호출부(L405).
  - 상세: 독립적으로 코드를 추적한 결과 두 항목 모두 이미 문서화된 것과 동일한
    결론에 도달했다. (1) `retryLastTurn` 이 `nodeExec.status===FAILED` 만 검증하고
    `execution.status===FAILED` 는 검증하지 않아, `ParallelErrorPolicy:'continue'`
    로 형제 브랜치가 살아있는(Execution=RUNNING) 상태에서 재시도가 호출되면
    `rehydrateContext` 가 형제와 동일한 live `ExecutionContext` 를 반환해
    `nodeOutputCache`/`_executedNodes` 등 공유 가변 상태를 동시 mutate 할 이론적
    경로가 있다(미재현, `assertTransition` 이 실제 CANCELLED/COMPLETED 케이스는
    막아준다). (2) 상태 전이 허용 여부의 SoT 가 `state-machine.ts`
    (`ALLOWED_TRANSITIONS`/`canTransition`) 와 엔진의 SQL 상수
    (`NON_TERMINAL_STATUSES_SQL` 계열) 두 곳에 독립 존재해 수동 동기화에 의존한다
    — 이번 8R CRITICAL 자체가 바로 이 두 SoT 의 불일치였고, 구조적으로는 재발
    가능성이 남는다.
  - 제안: 두 항목 모두 이미 P2 로 defer 등재되어 있고 근거(재현 불가·대체 가드
    존재)가 명시돼 있으므로 이번 라운드에 재조치를 요구하지 않는다. 향후 별도
    작업 시 plan 문서의 해당 항목을 참조.

## 요약

이번 라운드에서 검토 대상 3개 파일에 대한 실제 코드 변경은 `engine-driver.interface.ts`
의 JSDoc 추가 1건뿐이며 런타임 동작 변화는 없다. 해당 JSDoc 이 서술하는 "상태머신
opt-in(`allowRetryReentry`)과 DB 가드(FOR UPDATE 짝 전이 잠금 + else 분기 guarded
UPDATE) 양쪽에 함께 적용돼야 한다" 는 계약을 실제 구현(`execution-engine.service.ts`,
`ai-turn-orchestrator.service.ts`)까지 추적해 대조한 결과 모든 호출부(재-park,
finalizeAiNode 의 FAILED 분기·RUNNING 유지 분기·RUNNING 재claim 분기)에서 opt-in 이
상태머신·DB 가드 양쪽에 항상 짝으로 전달되고 있음을 확인했다. Lock 획득 순서도
Execution 행(FOR UPDATE) → NodeExecution 저장 순으로 두 소비처(`updateExecutionStatus`
짝 전이 분기, `tryLockActiveExecutionAndSaveNodeExec`)에서 일관되어 데드락 유발
소지는 낮다. opt-in 이 COMPLETED/CANCELLED 는 계속 배제하도록 SQL 상수가 올바르게
구성되어 있어 "진짜 동시 취소" 방어도 유지된다. 신규 CRITICAL/WARNING 은 발견하지
못했으며, 남아있는 아키텍처적 잔여 리스크(Parallel 형제의 공유 컨텍스트 동시 mutate
이론적 경로, 상태 전이 허용표의 이중 SoT)는 이미 `plan/in-progress/
retry-turn-terminal-guard.md` 에 근거와 함께 P2 defer 로 적절히 추적되고 있어 이번
리뷰에서 재상정하지 않는다.

## 위험도

LOW
