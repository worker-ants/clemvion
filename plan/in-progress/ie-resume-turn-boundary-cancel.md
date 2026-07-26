---
title: IE resume turn 경계 cancel 체크 + park 짝 전이 lost-update 차단
worktree: ie-resume-signal-6e933d
started: 2026-07-26
owner: developer
status: in-progress
priority: P1
spec_impact:
  - spec/conventions/node-cancellation.md
  - spec/5-system/4-execution-engine.md
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

짝 전이(3+ 인자) 호출부 **7건** — 전부 park↔resume 전이이고 **terminal 마킹은 0건**:

| 전이 | 호출부 |
|---|---|
| → `WAITING_FOR_INPUT` (park) | form-interaction:110, button-interaction:395, ai-turn-orchestrator:351, ai-turn-orchestrator:445 |
| → `RUNNING` (resume claim) | form-interaction:325, button-interaction:567, ai-turn-orchestrator:1373 |

(ai-review 2026-07-26 INFO #2 정정 — 최초 "8건" 은 `execution-engine.service.ts:8025` 를 잘못
포함했다; 그 라인은 JSDoc 주석 안의 예시 호출이라 실제 호출부가 아니다.)

DB 가 terminal 이면 park 도 재claim 도 **7건 전부 틀린 동작**이다 → 가드 추가가 의미적으로 안전.

## 작업 항목

- [x] **(A) choke point 가드** — `linkedNodeExec` 분기 트랜잭션 안에서 대상 row 를
      `SELECT ... FOR UPDATE` 로 잠그고 terminal 이면 두 save 를 모두 건너뛰고 `false` 반환.
      full-entity save 의 컬럼 의미(staged `conversation_thread`/`user_variables`/
      `resume_call_stack`)를 보존하기 위해 partial UPDATE 로 재작성하지 **않는다** — 행 잠금으로
      race 를 닫는다.
      > **명명 제약** (impl-prep naming_collision W4): 신규 가드는 `mark<X>Cancelled` 접두를
      > 쓰지 않는다 — `markNodeCancelled`/`markExecutionCancelled`/`finalizeCancelledExecution`
      > 이 이미 혼동 지대로 백로그돼 있어 4번째 유사 이름을 더하면 안 된다. "linked/paired
      > transition" 임을 이름에 명시한다.
- [x] **(B) turn 경계 체크 (티켓 본항목)** — resume turn dispatch **직전** cancel 관측 →
      `ExecutionCancelledError`. spec §2.1 이 지시한 방향. Stop 이 큐 대기 중 도착한 경우
      불필요한 LLM 호출 자체를 막는다.
- [x] **(C) re-park 결과 소비** — AI 경로에서 (A) 가 `false` 를 반환하면 park 이벤트를 emit 하지
      않고 취소로 종결한다.
- [x] 테스트 — (A) 반환 계약은 `execution-engine.service.spec.ts:4828~4870`(else 분기 선례)의
      idiom 을 미러. (B)/(C) 는 orchestrator 레벨.
- [x] **(D) spec 위임** (impl-prep W1/W2 — 이 plan family 가 3회 반복한 "developer 완료 → spec
      stale 방치" 패턴 차단) — developer 는 `spec/` 쓰기 권한이 없으므로
      [`spec-update-node-cancellation-shutdown-classification.md`](./spec-update-node-cancellation-shutdown-classification.md)
      **#7** 에 §2.1(IE 행 완화 서술 정정)·§6(신규 행)·§2.3(turn 경계 가드) 제안을 등재한다.
      **완료** — 커밋 `9da4aa29b`. 원자성 계약 SoT 인 `spec/5-system/4-execution-engine.md §1.1`
      갱신도 같은 위임에 포함할 것(짝 전이의 terminal 가드는 그 §1.1 이 서술하는 계약의 일부).
      #6 큐와 **같은 planner 턴에 배치** 처리한다(W3 — 두 plan 이 §5.2/§6 표를 따로 덮어쓰는 것 방지).
- [x] TEST WORKFLOW (lint / unit / build / e2e) — 2026-07-26 전부 PASS (unit: backend 412 suite / 8286 passed, e2e: 259 passed)
- [x] `/ai-review` + Critical·Warning 해소 — 2026-07-26 `review/code/2026/07/26/21_08_01`
      (Critical 1 / Warning 10). Critical #1 + 코드 Warning #5/#7/#9/#10 fix, Warning #6 e2e 추가,
      Warning #1/#2/#3 plan 재평가, Warning #8 plan 이동 체크리스트. TEST WORKFLOW 재통과
      (unit: backend 412 suite / 8298 passed, e2e: 260 passed). 상세: `RESOLUTION.md` 참조.
- [x] `/consistency-check --impl-done spec/conventions` — 2026-07-26 `review/consistency/2026/07/26/21_06_23`
      **BLOCK: NO** (Critical 0). WARNING 4건은 spec 위임 완전성·harness scoping 건으로 전부 반영
      (#7 보강 6~8번 + harness plan 기록, 커밋 `cccdd1ff9`)

## impl-prep 결과 (2026-07-26)

`review/consistency/2026/07/26/19_30_39` — **BLOCK: YES**, 단 **본 작업과 무관한 사유**.

CRITICAL 1건은 cafe24-api-catalog `mains_update`/`mains_delete` 의 pre-existing 모순이다.
`--impl-prep spec/conventions` 가 conventions **폴더 전체**를 스코프로 잡았고, 페이로드가 예산
초과로 정작 `spec_impact` 대상인 `node-cancellation.md` 본문을 생략한 채 알파벳순으로 앞선
`cafe24-api-catalog/**` 를 실은 결과다(5 checker 전원이 독립 확인). SUMMARY 자신이
*"이 CRITICAL 자체는 착수를 막을 필요가 없다"* 고 판정하고 별도 planner 티켓 분리를 권고했다.

→ CRITICAL 전문은 [`cafe24-backlog-residual.md`](./cafe24-backlog-residual.md) 로 이관(커밋
`c50336450`). `node-cancellation.md` 자체에는 CRITICAL 이 없고 WARNING 만 있으며, 그 WARNING
4건은 위 (D)·(A) 명명 제약·부모 plan 정정으로 전부 반영했다. 착수 계속.

## 후속 (본 PR 밖)

- **form/button 경로 미소비 (ai-review WARNING #2, 2026-07-26 재평가)** — form/button
  interaction 4개 호출부(`form-interaction.service.ts:110,325`,
  `button-interaction.service.ts:395,567`)는 여전히 `updateExecutionStatus` 짝 전이의
  반환값을 소비하지 않는다. **이전 서술("표시상 잔여")은 위험을 낮게 잡았을 수 있다** —
  DB 자체는 (A) FOR UPDATE 가드로 안전(재살아나지 않음)하지만, 짝 `NodeExecution` 이
  terminal 마킹되지 않아 AI 경로와 동일하게 **영구 RUNNING 으로 잔류**하거나, 클라이언트가
  이미 취소된 실행에 대해 "입력 대기"류 이벤트를 받을 수 있다 — 이는 표시상 중복이 아니라
  `NodeExecution` 행 자체의 데이터 일관성 갭이다. 후속 PR 에서 (A) 가 `false` 를 반환하면
  form/button 도 AI 경로와 동일하게 `markNodeCancelled` 재사용 + emit skip 으로 닫아야 한다.
- **가드 조합 로직 재사용 불가 (ai-review WARNING #1)** — `assertLinkedTransitionApplied`
  (관측→마킹→throw 절차)가 `AiTurnOrchestrator` 전용 private 메서드로 캡슐화돼 있어, 위
  form/button 후속 PR 이 이 로직을 그대로 재사용할 수 없다 — 복제하거나 순수 헬퍼로
  재추출해야 한다. form/button 미소비를 닫는 후속 PR 착수 시 함께 고려.
- **기준선 회귀 테스트 부재 (ai-review WARNING #3)** — `form-interaction.service.spec.ts:58`,
  `button-interaction.service.spec.ts:63` 모두 `updateExecutionStatus` mock 을
  `mockResolvedValue(true)` 로 고정해 둬, 위 갭을 닫는 후속 PR 의 "현재 동작" 기준선이 없다.
  후속 PR 착수 전에 각 spec 에 `mockResolvedValueOnce(false)` 케이스를 "알려진 제한사항"
  주석과 함께 먼저 추가해 두는 것을 권고(회귀 기준선 확보 → 그 다음 실제 fix).

## ⚠️ 이 plan 을 `plan/complete/` 로 이동할 때 (ai-review WARNING #8, 2026-07-26)

아래 3개 파일이 이 plan 을 상대경로로 직접 링크한다 — `plan-lifecycle.md` 가 plan→plan
상호참조 갱신 의무를 명시하지 않아, 이동 시 세 링크가 조용히 깨질 수 있다. **이동 커밋에서
반드시 함께 정정할 것**:

- [ ] `plan/complete/refactor/05-database.md:164` — `../../in-progress/ie-resume-turn-boundary-cancel.md`
- [ ] `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:334` — `ie-resume-turn-boundary-cancel.md`
- [ ] `plan/in-progress/node-cancellation-residual-signal-propagation.md:65` — `./ie-resume-turn-boundary-cancel.md`

## 체크리스트

- [x] (A) choke point 가드
- [x] (B) turn 경계 체크
- [x] (C) re-park 결과 소비
- [x] 테스트 (mutation 7/7 RED)
- [x] TEST WORKFLOW
- [x] `/ai-review` + Critical·Warning 해소 (RESOLUTION.md 참조)
- [x] `/consistency-check --impl-done` (BLOCK: NO)
- [ ] plan 이동 시 상호참조 링크 3곳 정정 (위 "⚠️" 절 참조)
