---
title: node-cancellation 잔여 — 채널/커머스 노드 signal 전파 + workflow-timeout 노드 abort
worktree: node-cancel-chat-9f3e
started: 2026-07-24
owner: developer
status: in-progress
priority: P3
---

## Overview

`spec/conventions/node-cancellation.md` §6 구현 현황 표가 **미구현(Planned)** 으로 남겨 둔
항목들의 추적 plan. 종전에는 `node-cancellation-infrastructure.md` 가 추적한다고 적혀
있었으나 **그 plan 은 2026-06-28 에 완료·이동**했고, 그 뒤 `node-cancellation-inflight-followups.md`
도 2026-07-24 에 완료되면서 **잔여 4항목을 추적하는 활성 plan 이 전무**해졌다.

> 출처: `review/code/2026/07/24/20_36_21` WARNING 2 — scope·side_effect·documentation
> **3명이 중복 지적**. `status: implemented` 승격과 §6 본문의 "미구현 4건" 이 어긋난다는 지적.
> 사용자 결정 **(A) 잔여 추적 plan 신설 + `status: partial` 유지**.

## 왜 spec 이 `partial` 로 되돌아가는가

`spec-status-lifecycle` 가드는 두 규칙을 함께 건다:

- (b) `partial` 은 **비어 있지 않은** `pending_plans` 를 가져야 한다
- (c) `partial` 의 `pending_plans` 가 **전부** `plan/complete/` 로 가면 `implemented` 로 승격해야 한다

2026-07-24 에 마지막 pending plan 이 완료되며 (c) 가 발동해 `implemented` 로 승격됐는데,
정작 §6 본문에는 미구현 4건이 남아 있었다 — 라벨과 본문의 불일치. 본 plan 이 신설되어
`pending_plans` 가 다시 채워지므로 (b) 를 만족하며 `partial` 로 되돌린다. **되돌림이 아니라
누락됐던 추적을 복원하는 것**이다.

## 잔여 항목 (§6 표 기준)

- [x] **chat-channel 노드 signal 전파** — **won't-do (범주 오류)**. 착수 전 프로브에서 전제가
      반증됐다: **chat-channel 노드는 존재하지 않는다**. 전 카테고리(ai·core·data·flow·
      integration·logic·presentation·trigger) 전수 확인 결과 `chat` 이름의 노드 파일 0건이고,
      `node-types.constants.ts` 에도 미등록이다.
      실체는 **`webhook` 트리거의 `config.chatChannel` 변형**이며(`1-data-model.md:230`),
      구현은 `modules/chat-channel/**` 의 어댑터다. 그 어댑터는 `executionEvents$` 를 **구독해
      외부 채널로 발송**하는 outbound 방향이라(CCH-AD-05) 노드 실행 컨텍스트가 없고
      `abortSignal` 참조도 0건이다. 취소된 실행은 오히려 `execution.cancelled` 를 발송해야 하니
      **cascade 대상 자체가 아니다**.
      → `node-handler.interface.ts` JSDoc 의 잘못된 나열을 정정하고 근거를 남겼다.
      spec §6 표의 해당 행 처분은 `spec/` 권한 밖이라 위임했고, **2026-07-26 planner 턴에서
      이행 완료**했다 — §1 나열에서 chat-channel 제거 + §6 행을 `N/A`(범주 오류로 철회) 로
      재기재 + `10-parallel.md:244` 의 같은 오분류 정정.
      초안·근거: [`spec-draft-node-cancellation-chat-channel-correction.md`](../complete/spec-draft-node-cancellation-chat-channel-correction.md).
- [x] **MakeShop 노드 signal 전파** (2026-07-25, handler 재throw 가드까지 포함) — `MakeshopCallOptions.signal` 신설,
      handler 가 `context.abortSignal` 을 전달, `executeWithRetry` 가 자기 timeout controller 로
      cascade(§4). 이미 aborted 면 즉시 abort(§2.2). `http-request.handler.ts` 와 동일 패턴.
- [x] **Cafe24 노드 signal 전파** (2026-07-25, handler 재throw 가드까지 포함) — MakeShop 과 대칭 적용(`Cafe24CallOptions.signal`).
- [ ] ⛔ **BLOCKED — `project-planner` 결정 대기**: Workflow 단위 timeout / graceful shutdown 의 노드 abort 통합
      > `/consistency-check --impl-prep` (`review/consistency/2026/07/25/19_13_33`) **Critical**.
      > `abortSignal` 을 이 경로에 연결하면 §5.1 의 `cancelled` 규칙과 이미 구현된
      > `ShutdownStateService` 의 `failed`+`SERVER_INTERRUPTED` bulk UPDATE 가 **같은 row 를
      > 두고 경합**한다(`WHERE status='RUNNING'` 선착순 → 비결정적 분류). 실측: 그 서비스는
      > `abortSignal` 참조 0건이라 지금은 두 경로가 만나지 않는다.
      > 결정 위임: [`spec-update-node-cancellation-shutdown-classification.md`](spec-update-node-cancellation-shutdown-classification.md).
      > **이 항목만 차단이며 나머지 항목은 무관하게 진행 가능**(signal 생산자가 ParallelExecutor·
      > 사용자 cancel 이라 §5.1 `cancelled` 가 이미 정답인 경로). — 워크플로 시간 한도
      자체는 PR2a 로 구현 완료(active-running 누적 타임아웃 `assertActiveTimeWithinLimit`,
      **노드 경계 판정**). 잔여는 **진행 중 노드의 in-flight 외부 I/O 즉시 중단**뿐
- [x] **IE multi-turn resume 경로 signal 미전파 — 이관으로 종결** (§2.1 표).
      2026-07-26 착수 시 무수정 프로브로 아래 서술이 반증됐고, 항목을
      [`ie-resume-turn-boundary-cancel.md`](./ie-resume-turn-boundary-cancel.md) 로 분리 이관했다.
      **본 항목의 완료 판정은 그 plan 이 소유한다**(중복 소유 방지).
      > **여기서 `[x]` 인 것은 "작업이 끝났다" 가 아니라 "이 plan 의 책임이 끝났다" 다.**
      > 종전엔 `[ ]` 로 남아 있어, 본문은 "저쪽이 소유한다" 고 말하는데 체크박스는
      > "여기 미완" 이라고 말하는 모순이었다(2026-08-10 실측 정정). 그 상태로는 이 plan 이
      > 영영 `complete/` 로 못 가고, 진행 상황 집계도 같은 항목을 두 번 센다.
      > 실제 진행은 그 plan 의 체크박스로 읽을 것.
      - ~~`processMultiTurnMessage` 에 signal 을 전파하는 것이 방향~~ → **전파할 signal 이 애초에 없다.**
        엔진 전체에서 `new AbortController()` 는 `parallel-executor.ts:188` 한 곳뿐이고, 외부 cancel 은
        signal 이 아니라 **DB 관측**(`assertExecutionNotCancelled` → `ExecutionCancelledError`) 기전이다.
        따라서 spec §2.1 이 적어둔 **turn 경계 abort 체크**가 유일한 방향.
      - ~~**완화 있음**: app-level 타임아웃이 hang 을 상한하므로 데이터 정합성 위험이 아니라 응답성 갭~~
        → **틀렸다.** 실제 결함은 `updateExecutionStatus` 의 `linkedNodeExec`(park 짝 전이) 분기가
        무가드 full-entity save 라, 턴 진행 중 Stop 으로 `CANCELLED` 된 실행이 턴 종료 후 re-park 에서
        `WAITING_FOR_INPUT` 으로 **되살아나는 lost update** 다. 타임아웃은 이걸 완화하지 못한다 —
        취소가 지연되는 게 아니라 **소실**된다. 정합성 결함.
      > 리뷰어가 지목한 4항목(§6 표) 밖이지만 **동일 결함 클래스**라 함께 담는다 — §2.1 의
      > 추적 포인터도 완료된 `node-cancellation-infrastructure.md` 를 가리키고 있었다.
      > spec §2.1(IE 행 완화 서술)·§6 정정은 developer 권한 밖 → `spec-update-*` 로 위임한다.

- [x] **선형 경로 cancel 전파의 기전 규명 + 결정적 고정** — **2026-07-26 완료. 기전은
      존재하지 않았다(진짜 결함).** 엔진 단위 테스트로 실증: 노드 1 실행 중 Execution 행이
      외부에서 `cancelled` 로 바뀌어도 **하류 노드 2개가 그대로 dispatch 됐다**(3/3 호출).
      원인은 두 겹이다 — (1) `executions.service.ts` 의 `stop()` 은 RUNNING 실행에 대해
      Execution 행을 UPDATE 할 뿐 **돌고 있는 루프에 아무 신호도 보내지 않는다**
      (AbortController·job cancel 없음), (2) 순회 루프는 상태를 **한 번도 다시 읽지 않는다**
      (유일한 경계 가드 `assertActiveTimeWithinLimit` 는 in-memory `savedExecution` 만 본다).
      → `spec/conventions/node-cancellation.md:140` 의 "dispatch 사전 abort 체크 ✓" 와
      `:60` 의 "stop 이 실행을 중단" 은 **선형 경로에서 사실이 아니었다**. 실질 피해는
      라벨 오류가 아니라 **부수효과**다: Stop 이후에도 이메일 발송·HTTP POST·DB 쓰기가 계속됐다.
      **조치**: `assertExecutionNotCancelled()` 를 노드 경계에 추가(순회 루프 3곳 —
      `runExecution` · `runNodeDispatchLoop` · `executeInline`). ~~mutation 검증
      완료(가드 제거 시 RED 3회 → 복원 시 GREEN 1회)~~ — **W7 정정(2026-07-26,
      아래 후속 참조): 실측은 RED 1회뿐이었다.** `runNodeDispatchLoop`/`executeInline`
      은 회귀 테스트가 없어 가드를 제거해도 407/407 GREEN(검출 불가)이었다 —
      `runExecution` 한 곳만 실제로 RED 였다. 아래 후속에서 누락됐던 회귀 테스트를
      추가하고 **7개 지점 전부**(선형 3곳 + 컨테이너/Parallel 2곳 + C1 재throw +
      ForEachExecutor 재throw) mutation 재검증을 완료했다(전부 RED → 복원 시 GREEN).
      **e2e 도 함께 고쳤다** — 기존 단언은 `waitForTerminalStatus` 가 stop 직후 즉시
      반환하는 탓에 **노드 A 가 아직 busy-wait 중일 때** 하류를 조회해, 가드가 전혀 없어도
      통과하는 구조였다(관측 시점이 너무 이름). A 의 종료를 기다린 뒤 판정하도록 변경.

  > **원 티켓의 문제 제기**(2026-07-24 ai-review 2R, 독립 reviewer 3명 수렴): e2e 가 "stop 후
  > 하류 노드 미도달" 을 3회 재현 + 대조군으로 관측했으나 **어느 코드가 그것을 보장하는지
  > 특정되지 않았고**, 후보 2개(`context.abortSignal?.throwIfAborted()` — 선형 경로에선 항상
  > undefined / "guarded UPDATE" — §7.5 resume-claim 전용 sentinel)가 모두 반증됐다.
  > **결론: 보장하는 코드가 없어서 특정되지 않았던 것이다.** e2e 는 타이밍 덕에 통과 중이었고
  > 그 한계는 당시 `RESOLUTION.md` §C1 에 정확히 기록돼 있었다.

  > **후속 — `review/code/2026/07/26/11_48_55` (2026-07-26)**: 위 최초 조치는 선형 3곳에는
  > 정확했으나 (a) `executeInline` 가드가 호출자(`WorkflowHandler`)에게 흡수돼 무력화,
  > (b) 컨테이너(ForEach/Loop/Map)·Parallel 브랜치 반복은 애초에 가드 범위 밖, (c)
  > `runNodeDispatchLoop`/`executeInline` 회귀 테스트가 실제로는 없어 mutation 이 GREEN(가드
  > 제거를 못 잡음) 이었다 — 전부 같은 turn 에서 처리 완료(코드+테스트, `RESOLUTION.md`
  > 참조). **mutation 재검증(7개 지점, 전부 개별 RED → 복원 GREEN)**: `runExecution`
  > (기존 커버리지) · `runNodeDispatchLoop`(신규 테스트) · `executeInline`(신규 테스트) ·
  > `executeContainerBody`(신규 테스트) · `executeParallelBranchBody`(신규 테스트) ·
  > `WorkflowHandler` 의 C1 재throw(신규 테스트) · `ForEachExecutor` 의 errorPolicy 우회
  > 재throw(신규 테스트, skip/continue 양쪽). **spec 갱신(§2.3/§5.1/§6 + `code:`)은
  > developer 권한 밖이라 project-planner 에 위임** — 자매 항목(MakeShop·Cafe24·chat-channel)
  > 과 동일하게
  > [`spec-update-node-cancellation-shutdown-classification.md`](spec-update-node-cancellation-shutdown-classification.md)
  > 의 **"추가 위임 (2026-07-26 #6)"** 절에 제안을 남겼다(이 항목의 spec 반영은 아직
  > 미이행 — planner 턴 대기).

  > **후속 2 — `review/code/2026/07/26/12_55_55` (2026-07-26, 검증 라운드)**: 위 확장이
  > 여전히 남겨둔 결함 1건(CRITICAL) + 산출 품질 갭 다수를 처리했다.
  >
  > - **C5 — `ParallelExecutor` `errorPolicy:'continue'` 가 취소를 흡수**: C3 가
  >   ForEach/Loop 에 준 재throw 가드와 구조적으로 동일한 결함이 Parallel 콤비네이터에
  >   남아 있었다. `errorPolicy` 분기 **이전에** `ExecutionCancelledError` 우회 재throw
  >   추가(`parallel-executor.ts`) + `parallel-executor.spec.ts` 대칭 회귀 테스트
  >   (`stop`/`continue`/`cancel-others-on-fail` 3정책 × 단독/co-occurring 실패 2케이스).
  > - **W9 — `runContainer` catch-all 이 취소를 일반 실패로 오분류**: 컨테이너 자신의
  >   `NodeExecution` 을 FAILED 로 영속 + `NODE_FAILED` WS emit 하던 것을, C1/C3 와
  >   대칭으로 `instanceof ExecutionCancelledError` 우회 재throw 로 차단. 회귀 테스트가
  >   `nodeExecutionRepository.save`/`emitNode` 인자를 직접 단언.
  > - **W10 — 아이템 경계 가드 비용**: "폴링 비용이 곱해지지 않는다" 던 원 SUMMARY INFO
  >   관측이 실측으로 반증됐다(입력 배열 길이 상한 없음 + 중첩 컨테이너 곱셈적). 시간
  >   기반 스로틀(200~300ms 권장, 실채택 250ms)을 `executeContainerBody` 호출부에만
  >   도입 — 선형/Parallel 브랜치의 **노드 경계** 호출은 여전히 매번 실제 조회한다.
  >   트레이드오프는 아래 별도 절 참조.
  > - **W11** — C4 배선(옛 raw `save()` → guarded `updateExecutionStatus`) 에 대한
  >   회귀 테스트 부재를 closed — guarded UPDATE 0행(이미 terminal) 시뮬레이션으로
  >   stale `finishedAt`/`durationMs` 미재저장을 단언.
  > - **W12** — 두 catch 의 취소 종결 8줄 블록을 `finalizeCancelledExecution` 헬퍼로 추출.
  > - **W13** — JSDoc/CHANGELOG 의 "status 단일 컬럼" 표현을 실제 `select`(id/status
  >   2컬럼)에 맞게 정정.
  >
  > **범위 밖으로 남긴 것(백로그, 아래 참조)**: `runParallel` 이 `ParallelResult.failures`
  > 를 전혀 소비하지 않는 별개 결함, `errorPolicy:'stop'` 의 `failures[0]` 우선순위 레이스.

  > **후속 3 — review 13_47_42 ~ 16_20_52 (3R~7R, 2026-07-26)**: 위 "후속" 기록은 2R 까지만
  > 담고 있었다. 최종 구현 범위는 **선형 3곳보다 훨씬 넓다** — 실제로 가드가 배치된 곳은
  > `runExecution` · `runNodeDispatchLoop` · `executeInline` · `executeContainerBody`(아이템
  > 경계, 250ms 스로틀) · `executeParallelBranchBody` **5곳**이고, `ExecutionCancelledError`
  > 우회 재throw 가 `workflow.handler`(Sub-Workflow) · `ForEachExecutor` · `ParallelExecutor` ·
  > `runContainer` · `executeNode` · `executeBackgroundSubgraph`(graceful swallow) **6곳**이다.
  > 추가로 3R~6R 에서 닫은 것: Background 본문의 스로틀 Map 누수(W14) · Sub-Workflow 노드가
  > 취소를 `failed` 로 오분류하고 내부 message 를 WS 로 방출하던 결함(W15) · 그 수정이 만든
  > **노드 영구 `running` 잔류**(W19) · `errorHandling.policy:'retry'` 노드에서 취소가
  > 재시도되던 결함(W20) · retry-turn 이 취소 시 `execution.error` 를 저장해 REST 로 노출하던
  > 결함(W16) · 취소 종결 중복 추출(W25) · JSDoc 고아·불변식 결속(W26·W27).
  > **위임 문서(#6)의 §6 표 제안 문구도 1R 시점에서 멈춰 있으니**, planner 가 반영하기 전에
  > 이 범위로 갱신해야 새 spec-drift 가 생기지 않는다.

### 백로그 — 이번 라운드 범위 밖으로 명시적으로 남긴 항목 (2026-07-26)

- **`runParallel` 이 `ParallelResult.failures` 를 읽지 않는다**
  (`execution-engine.service.ts` `runParallel`, `containers/parallel-executor.ts`
  `ParallelResult.failures`). `errorPolicy:'continue'` 로 브랜치 일부가 실패해도
  호출부가 `failures[]` 를 저장소 전체에서 한 번도 참조하지 않아, Parallel 노드가
  거짓 `done` 포트로 종결되고 출력이 오염될 수 있다. Parallel 이 그래프 최종 노드인
  흔한 패턴에서는 이후 가드 호출 자체가 없어 완전히 유실된다. C5(취소 우회 재throw)로
  **취소 경로만** 닫았고, 이 실패-소비 갭 자체는 별도 이슈다 — `meta.skippedCount`/
  `meta.iterations` 처럼 `failures`/`skippedCount` 를 Parallel 노드 output/meta 로
  표면화하는 작업이 필요.
- **`ParallelExecutor` `errorPolicy:'stop'` 의 `failures[0]` 우선순위 레이스**
  (`parallel-executor.ts:277` 부근). `branchIndex` 순서로 첫 실패를 채택하는데,
  취소와 진짜 실패가 다른 브랜치에서 동시 발생하면 어느 쪽이 `failures[0]` 이 되는지가
  완료 순서에 좌우돼 `cancelled`/`failed` 오분류 가능(좁은 레이스). `cancel-others-on-fail`
  은 이미 root-cause 우선 로직(`error.name !== 'AbortError'` 필터)이 있어 무해하지만
  `stop` 에는 없다. 현재 근거상 발생 빈도가 낮아(취소·실패 동시 도착) 승급 보류 —
  실제 오분류가 관측되면 `stop` 에도 root-cause 우선 선택을 추가.

- **선재 spec 파일 구조적 flakiness (W23)** — `execution-engine.service.spec.ts` 가 real-timer
  헬퍼 `flushResumeDrive` 를 쓴다(파일 자체 주석이 "CI 고부하 시 flaky" 를 명시). 64회 반복 중
  2회, `Date.now` 와 **무관한** 신규 테스트 2건이 flake 했다. 이 PR 이 만든 것이 아니라 선재
  구조 문제이고, 해소는 spec 파일 분할 규모의 작업이라 분리했다.
- **가드 시퀀스 헬퍼 승격 (W8)** — 노드 경계 진입부의 가드 시퀀스(`assertActiveTimeWithinLimit`
  + `assertExecutionNotCancelled` + 향후 추가분)를 단일 지점으로 묶는 중간 규모 리팩터.
  순회 루프 전면 통합은 과거 "엔진 재작성급 고위험" 으로 기각된 범위라 제외.
  **선행 확인 필요**: `executeInline` 이 `assertActiveTimeWithinLimit` 를 호출하지 않는 기존
  비대칭이 의도인지 먼저 판정해야 한다(통합하면서 무심코 없애거나 고착시킬 위험).
  > ⚠ `review/code/2026/07/26/11_48_55/RESOLUTION.md` 가 "이미 plan 에 명시돼 있음" 이라고
  > 적었으나 **사실이 아니었다**(impl-done 16_28_26 plan_coherence 실측). 이후 라운드들이 그
  > 잘못된 전제를 반복 인용만 했다 — 이 항목이 여기 처음 기록된다.
- **graceful shutdown 의 `FAILED`(SERVER_INTERRUPTED) 를 가드가 감지하지 못한다** —
  `assertExecutionNotCancelled` 는 `CANCELLED` 만 본다. `ShutdownStateService` 가 grace 만료로
  `FAILED`+`SERVER_INTERRUPTED` 를 마킹한 뒤에도 같은 프로세스의 dispatch 루프가 살아 있으면
  계속 dispatch 한다 — 이 PR 이 `stop()` 에 대해 막은 것과 **같은 결함이 shutdown 경로엔 남는다**.
  위 BLOCKED 항목(cancelled vs failed 계약 택일)이 결정되면 `status IN (CANCELLED, FAILED)`
  확장 여부를 함께 판단할 것.
  > `review/code/2026/07/26/11_48_55/concurrency.md` 가 "그 트래킹 문서에 명시적으로 남길 것"
  > 을 콕 집어 권고했으나 반영되지 않았다 — 여기 처음 기록된다.
- **`markNodeCancelled` 네이밍 혼동 (impl-done naming_collision)** — 같은 클래스에 이미
  `markExecutionCancelled`(Execution 레벨, resume 실패 발 system 취소)가 있어 `mark<X>Cancelled`
  패턴이 겹친다. 실제 설계상 이웃은 `finalizeCancelledExecution` 이므로 `finalizeCancelledNode`
  로 개명하거나 JSDoc 첫 줄에 "`markExecutionCancelled` 와 무관 — NodeExecution 대상" 을 명시.
  빌드·런타임 무영향이라 **코드 재검토 라운드를 다시 유발하지 않기 위해 백로그로 분리**했다.

### 트레이드오프 — 아이템 경계 cancel 가드 스로틀 (W10, 2026-07-26)

`assertExecutionNotCancelled` 의 컨테이너 아이템-경계 호출부(`executeContainerBody`)에
시간 기반 스로틀(`{ throttle: true }`, `CONTAINER_CANCEL_CHECK_THROTTLE_MS = 250`)을
도입했다.

- **문제**: ForEach/Loop/Map 은 입력 배열 길이 상한이 없고(`MAX_NODE_ITERATIONS` 와 무관),
  executor 가 `itemContext` 공유 mutate 때문에 순차 실행이라 아이템마다 PK SELECT 1건이
  그대로 누적된다. 1만 건이면 이 가드만으로 약 10~30초 직렬 추가 지연. 중첩 컨테이너는
  곱셈적(100×100=10,100회).
- **선택**: 노드 경계(선형 dispatch loop·Parallel 브랜치)는 매번 실제 조회를 유지하고,
  아이템 경계만 250ms 스로틀 — 스로틀 창 안의 반복 호출은 직전 결과(미취소)를 재사용해
  DB 라운드트립을 생략한다.
- **왜 무해한가**: `spec/conventions/node-cancellation.md` §2.2(CPU 바운드 / 즉시 완료 노드)가 전제하는
  취소 전파는 애초에 **best-effort** 계약이다 — 노드 경계(선형/Parallel) 관측 지연은
  이 변경으로 늘지 않고, 아이템 경계만 최대 250ms 늦게 관측될 수 있다. Stop 버튼 클릭 후
  수백 ms 이내에 다음 아이템 dispatch 가 멈추는 정도는 사용자 체감상 무해하다고 판단.
- **상태 관리**: `executionId` → 마지막 실제 조회 시각(ms)을 담는 in-memory Map
  (`containerCancelCheckedAtMs`, `segmentStartMs` 와 동일 패턴). **누수 방지**: execution
  종료 지점(`finalizeRehydrationCleanup`, `runExecution` catch/finally)에서 매번 delete —
  일부는 진짜 terminal 이 아니라 세그먼트 경계(재개 직전)에서도 지워지지만, 그 경우
  다음 세그먼트의 첫 호출이 스로틀 baseline 을 다시 세울 뿐이라 correctness 에 영향 없다
  (스로틀은 순수 최적화이지 정합성 메커니즘이 아니다).
- **대안으로 기각한 것**: "N회마다 1회" 카운트 기반 스로틀은 아이템 실행 시간이 들쭉날쭉할 때
  (예: 느린 body 노드) 오히려 지연 편차가 커진다 — 시간 기반이 취소 관측 지연의 상한을
  더 예측 가능하게 만든다.

### 해당 없음 (추적 대상 아님)

- **MongoDB driver `signal` 전달** — 현 DB 노드는 pg/mysql 만 지원하고 **mongo 미도입**이다.
  몽고 도입 시점에 함께 설계할 항목이라 본 plan 의 잔여로 세지 않는다(§6 표의 해당 행도
  "mongo 미도입" 을 사유로 명시).

## 선행 판단 (착수 전)

- **§2.2(사전 체크)와 §4(cascade)는 난이도가 다르다.** 사전 체크는 각 핸들러 진입부 1줄로
  끝나지만, cascade 는 클라이언트가 요청마다 signal 을 받아 전달하도록 배선해야 한다.
  **사전 체크만 먼저 하는 부분 이행**도 §5 계약을 충족한다(spec 이 best-effort 를 명시).
  전량-or-무 로 접근하면 3개 노드가 계속 미착수로 남는다 — 실제로 그렇게 남아 있었다.
- **best-effort 경계 재확인**: driver/transport 가 in-flight 중단을 지원하지 않으면 사전
  체크까지만 하고 spec 에 best-effort 로 남기는 것이 이 저장소의 확립된 처분이다
  (send-email `transporter.close()` 미채택 선례 — `node-cancellation-inflight-followups.md` §2).

## 관련

- `spec/conventions/node-cancellation.md` §2.2 · §4 · §6 (SoT)
- `codebase/backend/src/nodes/integration/makeshop/`·`cafe24/` (API 클라이언트)
- chat-channel 노드 핸들러
- 선행 완료: [`node-cancellation-infrastructure.md`](../complete/node-cancellation-infrastructure.md)(인프라) ·
  [`node-cancellation-inflight-followups.md`](../complete/node-cancellation-inflight-followups.md)(DB in-flight·e2e)

## Rationale

**왜 별 plan 인가.** §6 이 "추적 plan" 을 이름으로 가리키는데 그 대상이 완료 이동해 버리면
포인터가 죽는다 — 이번에 실제로 그렇게 됐고, 리뷰어 3명이 그 결과(라벨/본문 불일치)를
지적했다. 활성 plan 을 하나 두면 (b)/(c) 가드가 그 불일치를 **구조적으로** 막는다.

**왜 P3 인가.** 세 노드 모두 **사전 abort 체크조차 없어** cancel 시 진입을 막지 못하지만,
cancellation 자체는 Execution 레벨에서 `cancelled` 로 확정되고(§5) 하류 dispatch 도 멈춘다
— 즉 데이터 정합성 문제가 아니라 **불필요한 외부 호출 1회**가 발생하는 낭비다. 실제 피해가
관측되면 승급할 것.


## 진행 기록 — commerce 2건 (2026-07-25)

### 배선

`MakeshopCallOptions`/`Cafe24CallOptions` 에 `signal?: AbortSignal` 을 추가하고, handler 가
`context.abortSignal` 을 실어 보낸다. 두 client 는 이미 per-call timeout 용 `AbortController` 를
갖고 있어, spec §4 가 코드로 제시한 cascade 를 그 controller 에 붙였다 — `http-request.handler.ts`
가 쓰는 것과 같은 패턴(이미 aborted 면 즉시 abort, 아니면 listener + controller 정착 시 해제).

**`rawPing()` 은 대상이 아니다**: 연결 테스트 경로라 노드 실행 컨텍스트가 없다. 노드 실행은
`executeWithRetry()` 하나로 모인다.

### 테스트가 잡는 것

client 4건 × 2 + handler 2건 × 2. handler 쪽이 특히 중요하다 — **handler 가 signal 전달을
멈추면 client 의 cascade 는 dead code 가 되는데 client 테스트는 그대로 통과**한다. 실제로
그 두 축을 각각 mutation 으로 확인했다:

| 뮤턴트 | 결과 |
| --- | --- |
| handler 의 `signal: context.abortSignal` 제거 | handler spec **4 failed** |
| client 의 cascade 블록 제거 | client spec **4 failed** |

통제 테스트도 함께 뒀다 — upstream 이 안 터지면 fetch signal 도 안 터질 것, signal 이 없으면
`undefined` 를 넘길 것(전달이 신호를 **발명**하지 않아야 한다).


### 리뷰가 잡은 것 (2026-07-25, `review/code/2026/07/25/21_02_33`)

첫 cascade 구현이 세 결함을 갖고 있었다 — 전부 실측 확증 후 수정:

1. **취소가 `cancelled` 로 분류되지 않았다** — catch 가 `AbortError` 를 transport 오류로 감싸
   handler D4 가 `port:'error'` 로 매핑했다. `database-query.handler.ts` 의 재throw 패턴 적용.
2. **취소가 integration 을 강등시킬 수 있었다** — 같은 catch 가 `recordNetworkFailure` 를
   무조건 호출해, 형제 브랜치 3개 취소만으로 정상 integration 이 `error(network)` 가 된다.
   **timeout abort 와 구분**(`upstream?.aborted`)해야 정확하다 — timeout 은 진짜 장애다.
3. **성공 경로에서 리스너가 해제되지 않았다** — cleanup 을 `controller.signal` abort 에 걸었는데
   성공한 요청은 controller 를 abort 하지 않는다. `finally` 로 이동. 선재 동일 결함이
   `http-request.handler.ts` 에도 있다(후속).

### 이번 배선이 **덮지 않는** 대기 구간 (W5, 명시적 범위 밖)

cascade 는 **in-flight fetch** 를 끊는다. 같은 client 안의 두 대기 구간은 signal 을 보지 않아,
그 사이에 취소가 오면 대기를 끝까지 마친 뒤 **다음 재귀 진입 시점에** 반영된다:

- **429 backoff sleep** (`sleepImpl`) — 최대 `Retry-After` 초만큼 지연.
- **401 reactive refresh 대기** — BullMQ `waitUntilFinished` 또는 DB row lock.

이번 범위에 넣지 않은 이유: 둘 다 fetch 가 아니라 **다른 종류의 대기**이고(주입된 sleep,
큐 대기), 각각 별도의 검증 표면을 연다. `Promise.race` 로 signal-aware 하게 만드는 것은
가능하지만, 그 변경은 sleep 주입 계약·큐 대기 취소 의미까지 함께 판단해야 한다.

취소가 **유실되지는 않는다** — 대기가 끝나면 다음 attempt 의 사전 체크(§4 already-aborted)가
즉시 걸린다. 지연될 뿐이다.

### `--impl-done` 이 잡은 것 — 배선이 엔진까지 닿지 않았다

client 에서 `AbortError` 를 재throw 하도록 고쳤는데 **handler 의 catch 가 다시 삼켰다**.
`mapClientErrorToOutput` 에 AbortError 분기가 없어 `{code:'*_TRANSPORT_FAILED', port:'error'}`
를 **정상 반환**했고, throw 가 아니므로 엔진의 `isAbortError` catch 가 영영 도달하지 못했다 —
노드는 `failed` 로 기록되고 `execution.node.cancelled` 도 안 났다. 무수정 프로브로 실증.

**forwarding 테스트는 이걸 못 봤다** — signal 이 전달되는지만 봤지 **client 가 reject 했을 때
handler 가 어떻게 반응하는지**는 안 봤기 때문이다. handler 의 inner/outer catch 양쪽에 가드를
넣고, propagate + 경계(일반 transport 실패는 여전히 error 포트) 테스트를 추가했다.

### 후속으로 남긴 것

- `http-request.handler.ts` 의 같은 리스너 누수(선재) + abort-cascade 3중 복제 → 공용 헬퍼.
  **spec §4 예시 자체가 그 누수 패턴**이라 spec 갱신과 함께 가야 한다(planner 위임에 기재).
- 429 backoff / 401 refresh 대기 구간의 signal 관측 (위 §W5).
- ~~§6 표 두 행 갱신은 `spec/` 권한 밖이라 planner 위임.~~ → **2026-07-26 이행 완료**:
  MakeShop·Cafe24 행을 `✓` 로 갱신(근거를 client §4 cascade + handler §5.1 재throw 양쪽으로 명시,
  위임 문서가 요구한 "handler propagate 실증" 조건을 테스트 4건으로 충족). 같은 턴에서
  chat-channel 행도 `N/A` 로 처분했다 —
  [`spec-draft-node-cancellation-chat-channel-correction.md`](../complete/spec-draft-node-cancellation-chat-channel-correction.md).
