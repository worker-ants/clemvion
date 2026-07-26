---
title: IE resume turn 경계 cancel 체크 + park 짝 전이 lost-update 차단
worktree: ie-resume-signal-6e933d
started: 2026-07-26
owner: developer
status: in-progress
priority: P1
spec_impact:
  - spec/conventions/node-cancellation.md
---

## Overview

`node-cancellation-residual-signal-propagation.md` 의 잔여 항목 **"IE multi-turn resume 경로
signal 미전파"** 를 착수하며 **무수정 프로브**로 전제를 검증한 결과, 티켓이 적어둔 것보다
심각한 결함이 같은 자리에 있었다.

티켓 서술: *"데이터 정합성 위험이 아니라 응답성 갭"* (app-level 타임아웃이 hang 을 상한).
**실측 결과 이 서술은 틀렸다** — turn 진행 중 Stop 이 **조용히 무효화**된다.

## 프로브로 확정한 사실

| # | 주장 | 실측 |
|---|---|---|
| 1 | resume 경로에 전파할 signal 이 있다 | **없다.** 엔진 전체에서 `new AbortController()` 는 `parallel-executor.ts:188`(cancel-others-on-fail) 단 1곳. 외부 cancel 기전은 signal 이 아니라 **DB 관측**(`assertExecutionNotCancelled` → `ExecutionCancelledError`, #1021). 따라서 "signal 전파" 는 아키텍처상 불가 — spec §2.1 이 지시한 **turn 경계 abort 체크**가 유일한 방향이다 |
| 2 | CANCELLED 실행이 resume 으로 부활한다 | **반증.** `rehydrateAndResume` 이 `status ∉ {WAITING_FOR_INPUT, RUNNING}` → `RehydrationError` 로 차단 |
| 3 | turn 경계에 cancel 가드가 있다 | **없다.** `ai-turn-orchestrator.service.ts` 전체에 `assertExecutionNotCancelled` / `ExecutionCancelledError` 참조 0건 |
| 4 | re-park 가 terminal 상태를 보호한다 | **아니다 — 본 plan 의 핵심 결함.** 아래 |

### 핵심 결함 — park 짝 전이의 lost update

`updateExecutionStatus`(상태 전이 단일 choke point) 의 `linkedNodeExec` 분기
([execution-engine.service.ts:8126](../../codebase/backend/src/modules/execution-engine/execution-engine.service.ts)):

```ts
if (linkedNodeExec) {
  await this.dataSource.transaction(async (manager) => {
    execution.status = newStatus;
    await manager.save(Execution, execution);   // ← 무가드 full-entity save
    await manager.save(NodeExecution, linkedNodeExec);
  });
  this.emitTerminalExecutionMetrics(execution, newStatus, true);
  return true;                                   // ← 무조건 true
}
```

M-3 은 **else 분기**만 guarded UPDATE(`status IN ('pending','running','waiting_for_input')`)
로 교체하고 짝 전이는 주석으로 **"범위 밖"** 이라 명시해 남겼다. 그 자리가 살아있는 결함이다.

재현 경로 (AI multi-turn):

1. 실행이 `WAITING_FOR_INPUT` 로 park
2. 사용자 메시지 도착 → resume claim → DB `RUNNING`, `savedExecution` 엔티티도 `RUNNING`
3. **턴 진행 중**(LLM 호출 수 초~수 분) 사용자가 Stop → `executions.service.ts:stop()` 이
   `status IN (RUNNING, PENDING)` 가드 UPDATE 로 DB 를 `CANCELLED` + `finishedAt`/`durationMs` 로 마감
4. 턴 완료 → re-park `updateExecutionStatus(savedExecution, WAITING_FOR_INPUT, nodeExec)`
   - `assertTransition(RUNNING → WAITING_FOR_INPUT)` 통과 — **in-memory 엔티티가 stale**
     (orchestrator 는 Execution 을 재로드하지 않는다. `findOne` 은 NodeExecution 뿐)
   - full-entity save 가 `CANCELLED` → `WAITING_FOR_INPUT`, `finishedAt` → `null` 로 **덮어씀**
   - `true` 반환 → caller 가 `EXECUTION_WAITING_FOR_INPUT` emit

결과: 사용자가 누른 Stop 이 사라지고 실행이 다시 재개 가능 상태로 보인다. #1021 의 노드 경계
가드는 park 가 세그먼트를 끝내므로 **도달하지 않는다**.

### blast radius (실측)

짝 전이(3+ 인자) 호출부 **8건** — 전부 park↔resume 전이이고 **terminal 마킹은 0건**:

| 전이 | 호출부 |
|---|---|
| → `WAITING_FOR_INPUT` (park) | form-interaction:110, button-interaction:395, ai-turn-orchestrator:350, :435, execution-engine:8023 |
| → `RUNNING` (resume claim) | form-interaction:325, button-interaction:567, ai-turn-orchestrator:1341 |

DB 가 terminal 이면 park 도 재claim 도 **8건 전부 틀린 동작**이다 → 가드 추가가 의미적으로 안전.

## 작업 항목

- [ ] **(A) choke point 가드** — `linkedNodeExec` 분기 트랜잭션 안에서 대상 row 를
      `SELECT ... FOR UPDATE` 로 잠그고 terminal 이면 두 save 를 모두 건너뛰고 `false` 반환.
      full-entity save 의 컬럼 의미(staged `conversation_thread`/`user_variables`/
      `resume_call_stack`)를 보존하기 위해 partial UPDATE 로 재작성하지 **않는다** — 행 잠금으로
      race 를 닫는다.
- [ ] **(B) turn 경계 체크 (티켓 본항목)** — resume turn dispatch **직전** cancel 관측 →
      `ExecutionCancelledError`. spec §2.1 이 지시한 방향. Stop 이 큐 대기 중 도착한 경우
      불필요한 LLM 호출 자체를 막는다.
- [ ] **(C) re-park 결과 소비** — AI 경로에서 (A) 가 `false` 를 반환하면 park 이벤트를 emit 하지
      않고 취소로 종결한다.
- [ ] 테스트 — (A) 반환 계약은 `execution-engine.service.spec.ts:4828~4870`(else 분기 선례)의
      idiom 을 미러. (B)/(C) 는 orchestrator 레벨.
- [ ] TEST WORKFLOW (lint / unit / build / e2e)
- [ ] `/ai-review` + Critical·Warning 해소
- [ ] `/consistency-check --impl-done spec/conventions`

## 후속 (본 PR 밖)

- form/button 경로에서 (A) 가 `false` 일 때의 park 이벤트 emit 잔여 — 실행은 이미 CANCELLED 이고
  종료 이벤트도 `stop()` 이 발행했으므로 **표시상 잔여**이지 정합성 결함은 아니다. (C) 를 AI
  경로에만 적용하므로 form/button 은 별도 판정 필요.

## 체크리스트

- [ ] (A) choke point 가드
- [ ] (B) turn 경계 체크
- [ ] (C) re-park 결과 소비
- [ ] 테스트
- [ ] TEST WORKFLOW
- [ ] `/ai-review`
- [ ] `/consistency-check --impl-done`
