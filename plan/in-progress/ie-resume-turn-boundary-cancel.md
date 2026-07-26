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
- [x] `/ai-review` + Critical·Warning 해소 (3차 라운드) — 2026-07-26 `review/code/2026/07/26/22_11_22`
      (Critical 0 / Warning 9). WARNING #1(잔여 TOCTOU, architecture·requirement·concurrency
      3개 reviewer 공통 지적)을 `assertActiveExecutionAndSaveNodeExec`(형제 분기와 동일한
      FOR UPDATE 트랜잭션 원자화)로 완전히 닫음(주석/알려진 리스크로 남기지 않음). #3
      CHANGELOG "AI 경로 4곳" 정정 + 4번째 메커니즘 명시, #5 `applied`→`shouldProceed` 파라미터
      명 개정 + JSDoc 이중 계약 명시(WARNING #1 fix 로 실질적으로 단일 계약이 됨), #8 phase
      문자열 단언 2곳 추가, #9 e2e 고정 `setTimeout(2_500)` → `node_execution` terminal poll
      전환. #2(WS emit 순서 갭)/#4(`markNodeCancelled` 초기화 계약)/#6(4줄 마무리 블록 중복)/
      #7(public 표면 확대)은 "후속(본 PR 밖)" 절에 증상·영향·닫는 방법 명시 등재(코드 변경
      없음). SPEC-DRIFT 1건은 이미 위임된 `spec-update-node-cancellation-shutdown-classification.md`
      #7(보강 8번)로 흡수(추가 조치 없음, 단 `EngineDriver` 멤버 수 목표를 신규 메서드 반영해
      15/10 으로 재갱신). TEST WORKFLOW 재통과. 상세: `RESOLUTION.md` 참조.
- [x] `/ai-review` + Critical·Warning 해소 (4차 라운드, 수렴 라운드) — 2026-07-26
      `review/code/2026/07/26/23_05_48` (Critical 0 / Warning 6). 발견의 성격이 동작 결함에서
      구조·문서·테스트 완결성으로 완전히 이동해 이번 라운드로 코드 변경을 수렴한다. WARNING
      #6(`applied`→`shouldProceed` rename 미전파 6곳: JSDoc `@throws` 4곳 + 테스트 주석 2곳)
      전부 정정. WARNING #5(phase 문자열 단언 잔여 2곳: 첫 turn park·retry-last-turn RUNNING
      재claim)에 나머지 소비처와 동일하게 phase 정규식 단언 추가. WARNING #4(`assert*` 명명
      계약 불일치 — non-throwing/bool 반환 메서드가 throw 관례 접두를 씀, 이 PR 이 고친
      CRITICAL과 동형의 실수 유발 가능)를 `assertActiveExecutionAndSaveNodeExec` →
      `tryLockActiveExecutionAndSaveNodeExec` 로 개명(인터페이스·구현·호출부·테스트 전부
      동반 갱신, 멤버 수는 불변 15/10 — rename-only). WARNING #1(FOR UPDATE 잠금 조회가
      `assertActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` 의 `linkedNodeExec`
      분기 두 곳에 복제)을 `lockNonTerminalExecutionRow(manager, executionId): Promise<boolean>`
      private 헬퍼로 추출해 잠금 조회만 공유(각 호출부의 save 절차·조기 return 은 독립 유지) —
      기존 mutation 커버리지(양쪽 describe 의 조기 return/FOR UPDATE/비-terminal 조건 각각
      제거 시 RED)가 추출 후에도 양쪽에서 독립적으로 재현됨을 확인. WARNING #2(WS emit 순서
      갭)·#3(public 표면 확대)은 아래 "4차 라운드 추가 후속" 절에 재확인 서술만 갱신(코드
      변경 없음). TEST WORKFLOW 재통과(lint/unit: backend 412 suite·8302 passed/build/
      e2e: 260 passed). 상세: `RESOLUTION.md` 참조.
- [x] `/ai-review` + Critical·Warning 해소 (5차 라운드, **파일 전수 리뷰**) — 2026-07-27
      `review/code/2026/07/27/00_00_47` (Critical 2 / Warning 6). 직전 4개 라운드가
      증분 changeset 만 봤던 것과 달리 이번은 `--route=all` + 파일 명시 전수 리뷰라,
      이 PR 이 이미 4곳에서 닫은 "동시 Stop 취소 소실" 실패 계층이 남은 두 자리
      (신규 진입점 하나 + 손대지 않은 형제 분기 하나)에서 재발한 것이 드러났다.
      **CRITICAL #1** — `handleAiMessageTurn` 최상단 turn 경계 가드
      (`assertExecutionNotCancelled`, node-cancellation §2.3 로 이 PR 이 신규 도입)가
      곧장 throw 해 통일 계약(`assertLinkedTransitionApplied`)을 우회 → 짝
      NodeExecution 영구 RUNNING 고아. 다섯 번째 소비처로 통일해 해소.
      **CRITICAL #2** — `finalizeAiNode` 의 `isFailed` 분기(형제 COMPLETED 분기는
      이미 가드됨)가 무가드라, LLM 호출 도중 Stop → CANCELLED 이후 그 호출이
      자연 실패(429/timeout)하면 CANCELLED 를 FAILED 로 덮어쓰는 lost-update 재발 →
      동일 가드(`tryLockActiveExecutionAndSaveNodeExec`) 재사용으로 해소. WARNING
      #1(database, `cancelParkedExecution` 이중 UPDATE 비원자 — `markWebChatIdleTimeout`
      선례와 동일하게 트랜잭션 원자화), #4(architecture/documentation, 클래스 docblock
      정적 줄 수 stale — 하드코딩 수치 제거 + plan 포인터로 대체), #5(documentation,
      테스트 주석 하드코딩 줄 번호 2곳 — describe 이름 인용으로 교체) 코드/테스트로 해소.
      WARNING #2(form/button 미소비)·#3(`handleAiMessageTurn` 과다 길이 + payload 중복)·
      #6(FOR UPDATE 비용)은 이미 위 "3차/4차 라운드 추가 후속" 절에 등재된 항목의
      재확인이거나 신규 저위험 항목이라 코드 변경 없이 아래 "5차 라운드 추가 후속"
      절에만 등재. SPEC-DRIFT 2건은 신규 조치 없음 — 이미
      `spec-update-node-cancellation-shutdown-classification.md` #7 로 위임 완료,
      `spec/` 수정 금지 유지. TEST WORKFLOW 재통과(lint/unit/build 통과 — unit: backend
      execution-engine.service.spec.ts 430 passed·ai-turn-orchestrator.service.spec.ts
      86 passed 확인·전체 unit 스테이지 PASS, e2e: 260 passed). 상세: `RESOLUTION.md` 참조.

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

### 3차 라운드 추가 후속 (ai-review `review/code/2026/07/26/22_11_22`, Critical 0)

이번 라운드는 WARNING #1(잔여 TOCTOU)·#3(CHANGELOG stale)·#8(phase 문자열 미검증)·
#9(e2e 고정 sleep)·#5(`applied` 파라미터 이질적 계약)는 코드/테스트로 닫았다(RESOLUTION.md
참조). 아래는 명시적으로 "문서/plan 로만 닫을 것"으로 분류된 잔여 항목이다 — **코드 변경 없음**.

- **WS 이벤트 emit 이 취소 재확인보다 먼저 실행 (ai-review WARNING #2)** — `handleAiMessageTurn`
  이 turn-경계 cancel 가드(LLM 호출 **이전**)를 통과한 뒤, LLM 호출이 끝나면 취소 재확인 없이
  `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT`(또는 terminal `AI_MESSAGE`)을 무조건 emit 한다
  (`ai-turn-orchestrator.service.ts` `handleAiMessageTurn`, AI_MESSAGE emit 825-855/953-984,
  EXECUTION_WAITING_FOR_INPUT emit 888-923). 짝 전이/RUNNING 유지 가드는 그 이후 별도 메서드
  (`finalizeAiNode`/`reparkAiResumeTurn`)에서 실행되므로, LLM 호출 도중 Stop 을 눌러도
  클라이언트는 "대화가 계속된다"는 이벤트를 먼저 받는다.
  - **증상**: turn 진행 중 Stop 을 누르면 DB 는 안전(최종 상태는 CANCELLED 로 수렴)하지만,
    WS 로 `AI_MESSAGE`/`EXECUTION_WAITING_FOR_INPUT` 이벤트가 먼저 도착해 UI 가 잠깐
    "대화가 계속된다"고 보여줄 수 있다 — 이 PR 이 고치려던 증상("Stop 이 조용히
    무효화된 것처럼 보임")과 같은 결의 표시 계층 갭.
  - **영향**: DB 최종 상태는 안전 — 사용자 체감(표시) 문제로 한정. 데이터 정합성 위험 아님.
  - **닫는 방법**: emit 직전에 `assertExecutionNotCancelled` 재확인을 추가해 취소 시 emit 을
    건너뛴다 — 단 emit 지점(AI_MESSAGE 2곳 + EXECUTION_WAITING_FOR_INPUT 1곳)마다 재확인이
    필요해 범위가 이번 PR 보다 커진다. 별도 후속 PR 로 처리.
  - **확인 필요**: FE 가 지연 도착한 `EXECUTION_WAITING_FOR_INPUT`/`AI_MESSAGE` 보다
    `NODE_CANCELLED`/`EXECUTION_CANCELLED` 를 항상 우선(최신 것으로 덮어씀)하는지 — 프론트
    store 의 이벤트 도착 순서 처리 로직을 후속 PR 착수 시 먼저 확인할 것.
- **`markNodeCancelled` 사전 초기화 계약이 타입이 아닌 주석 (ai-review WARNING #4)** —
  `markNodeCancelled` 호출 전 `nodeExec.outputData`/`error` 를 비워야 한다는 계약이
  호출부 주석(`assertLinkedTransitionApplied` 내부, `ai-turn-orchestrator.service.ts:356-363`)
  으로만 강제된다 — 후속 form/button PR 이 이 헬퍼(`execution-engine.service.ts:4585-4611`)
  를 재사용하며 사전 초기화를 빠뜨리면 취소된 NodeExecution 이 성공 페이로드를 노출하는
  결함이 재발할 수 있다. 후속: `markNodeCancelled` 자신이 초기화를 항상 흡수하거나, 옵션
  플래그(`clearPayload?`)로 인터페이스 시그니처에 명시.
- **`updateExecutionStatus` 두 분기의 4줄 마무리 블록 중복 (ai-review WARNING #6)** —
  `linkedNodeExec`/else 두 분기 끝의 `recordRunningSegmentStart`+`emitTerminalExecutionMetrics`
  +`return persisted` 가 그대로 중복 이식돼 있다(`execution-engine.service.ts:8201-8205` vs
  `:8245-8249`). 후속: 공통 후처리를 함수 끝 단일 지점 또는 사설 헬퍼로 추출.
- **`markNodeCancelled`/`assertExecutionNotCancelled` public 전환 표면 확대 (ai-review
  WARNING #7)** — `ExecutionEngineService` 의 두 메서드가 `private`→`public` 으로 바뀌어
  `AiTurnEngineDriver` 노출 목적(기존 `updateExecutionStatus` 선례와 일관)으로 의도된
  변경이나, concrete 클래스 직접 참조 코드가 DI 계약(`ENGINE_DRIVER` 경유, 턴/노드 경계에서만
  호출)을 우회할 잠재 경로가 생긴다. 조치 불요(설계 의도) — 후속 form/button PR 이
  `ENGINE_DRIVER` 토큰 경유가 아닌 직접 참조를 추가하지 않는지 리뷰 시 확인.

### 4차 라운드 추가 후속 (ai-review `review/code/2026/07/26/23_05_48`, Critical 0 — 수렴 라운드)

4차 라운드는 WARNING #1(FOR UPDATE 잠금 조회 중복)·#4(`assert*` 명명 계약 불일치)·#5(phase
문자열 단언 잔여)·#6(rename 미전파)를 코드/테스트로 닫았다(RESOLUTION.md 참조). 이번 라운드도
"발견의 성격이 동작 결함 → 구조·문서·테스트 완결성"으로 완전히 이동했다고 판단해 코드 변경을
수렴하고, 아래 2건은 재확인 서술만 갱신한다 — **코드 변경 없음**.

- **WS 이벤트 emit 순서 갭 (ai-review WARNING #2, 4차 재확인)** — 3차 라운드 서술(위
  "3차 라운드 추가 후속" 참조)과 동일한 갭이 4차 라운드에서도 재확인됐다. 위치·닫는 방법·
  확인 필요 사항 변동 없음 — 이 plan 이 완료 이동될 때까지 반복 재확인만 되고 있으므로, 후속
  PR 착수 우선순위를 이 항목에 실질적으로 부여할 것을 권고(4라운드 연속 발견 = 낮은 우선순위가
  아니라 "누적 미착수"에 가깝다).
- **public 표면 확대 (ai-review WARNING #3, 4차 재확인)** — 3차 라운드와 동일한 소견, 개명(W4)
  으로 위치만 갱신: `execution-engine.service.ts:4586`(`markNodeCancelled`)`,7996`
  (`assertExecutionNotCancelled`)`,8089`(`tryLockActiveExecutionAndSaveNodeExec`, 이전
  `assertActiveExecutionAndSaveNodeExec:8049`에서 개명+이동) / `engine-driver.interface.ts:137,164,193`
  (이전 `134,161,183`). 조치 불요(설계 의도) — 확인 필요 사항 동일.
- **`EngineDriver` JSDoc 멤버 수 하드코딩이 매 라운드 stale 화 (ai-review INFO #6)** —
  `engine-driver.interface.ts:36-44` 의 "현재 멤버 수" 문구가 이번 PR 안에서만 세 번째로
  갱신 대상이 됐다(12/7→14/9→15/10, 4차 라운드는 rename-only 라 수치 불변이나 문구는 다시
  손을 댔다). 후속: 정확한 수치 나열 대신 "갱신 절차"(예: "PR 병합 전 `grep -c` 로 실측 후
  갱신, 값 자체는 여기 하드코딩하지 않는다")로 대체하는 리팩터 검토.
- **`recordRunningSegmentStart`(진입) vs `segmentStartMs` 정리(이탈)의 가드 비대칭 (ai-review
  INFO #8)** — 진입은 `persisted` 확인 후에만 기록되도록 WARNING #9(3차 라운드)로 고쳤으나,
  이탈 쪽 정리(`execution-engine.service.ts` 현재 `updateExecutionStatus` 본문, 두 분기의
  RUNNING 이탈 시각 합산 블록)는 트랜잭션 결과와 무관하게 먼저 실행된다. DB 오염 없음(in-memory
  카운터만 비대칭) — 후속: 일관성을 위해 이탈 쪽도 `persisted` 확인 이후로 이동하는 리팩터 검토
  (우선순위 낮음, 필수 아님).
- **`markNodeCancelled` 비원자 save 로 인한 크래시 창 (ai-review INFO #2, 3차 라운드부터 반복
  확인)** — 짝 `NodeExecution` 의 terminal 마킹(`markNodeCancelled`)이 Execution 을 판정한
  `FOR UPDATE` 트랜잭션과 분리된 별도 save 라, 트랜잭션 커밋~`markNodeCancelled` 완료 사이
  크래시 시 `NodeExecution` 이 비-terminal 로 좁게 잔류할 수 있다(저위험, 신규 아님). 후속:
  stalled-job recovery 백스탑이 이 케이스(NodeExecution=RUNNING, Execution=CANCELLED)를
  커버하는지 확인 — 우선순위 낮음.

### 5차 라운드 추가 후속 (ai-review `review/code/2026/07/27/00_00_47`, 파일 전수 리뷰 — Critical 2 해소, Warning 3건 코드 변경 없음)

5차 라운드는 CRITICAL #1(turn 경계 가드 우회)·#2(FAILED 경로 무가드)·WARNING #1(database,
`cancelParkedExecution` 비원자)·#4(architecture/documentation, docblock stale)·#5
(documentation, 테스트 줄 번호 stale)를 코드/테스트로 닫았다(RESOLUTION.md 참조). 아래
3건은 지시에 따라 **코드 변경 없이** 이 절에만 등재한다.

- **form/button 경로 미소비 (ai-review WARNING #2, 5차 재확인)** — 위 최초 "후속 (본 PR
  밖)" 절의 "form/button 경로 미소비" 항목과 동일 소견의 재확인(2026-07-26 최초 등재 이후
  5차 라운드에서 두 번째로 재발견). 위치·영향·닫는 방법 변동 없음 — `form-interaction
  .service.ts:110,325`, `button-interaction.service.ts:395,567`.
- **`handleAiMessageTurn` 과다 길이 + `AI_MESSAGE` payload 중복 (ai-review WARNING #3,
  신규)** — `ai-turn-orchestrator.service.ts` `handleAiMessageTurn` 이 6가지 책임을 한
  함수(약 375줄)에 담으며, waiting/terminal 두 분기의 `AI_MESSAGE` emit 페이로드 구성
  로직이 거의 동일하게 중복된다(한쪽만 수정하고 다른 쪽을 놓칠 회귀 위험). 후속: 두 분기를
  각각 private 헬퍼로 분리하고 공통 페이로드 빌더를 단일 헬퍼로 추출.
- **AI turn 정상 종료 경로 트랜잭션/FOR UPDATE 비용 (ai-review WARNING #6, 신규)** —
  `tryLockActiveExecutionAndSaveNodeExec`(3차 라운드에서 RUNNING 유지 분기에 도입, 5차
  라운드에서 isFailed 분기도 공유하도록 확장)가 AI turn 종료의 주 경로에 트랜잭션 +
  단일 행 FOR UPDATE 잠금을 추가했다 — PK 인덱스 단일 행 잠금이라 절대 비용은 작으나
  누적 빈도가 높은 경로. 우선순위 낮음 — race 를 닫기 위한 의도된 트레이드오프(WARNING
  #1 원자화의 자연스러운 귀결). 필요 시 "조건부 UPDATE...RETURNING" 단일 statement 로
  합쳐 라운드트립 절감 검토.

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
