---
worktree: impl-exec-concurrency-cap
started: 2026-06-04
owner: developer
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/1-data-model.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/6-websocket-protocol.md
  - spec/data-flow/3-execution.md
---

# 구현 추적 — 실행엔진 분산: execution-level intake 큐

> **✅ 완료 — complete 이동(2026-07-04)**: PR1(intake 큐 #—)·PR2a(active-running 타임아웃 #469)·PR3(크래시 re-drive, exec-park #795)·PR4(stalled 자동 재배달 #798)·PR2b(동시성 cap enforcement, spec #800 + impl #801) **전부 구현·머지**. 잔여 후속(priority 3-tier·workflow-level cap validated DTO·곁들임 INFO 리팩터 묶음·orphan pending backstop·admission 회귀 보강·auth 무관 건)은 [`exec-intake-followups.md`](../in-progress/exec-intake-followups.md) 로 이관.

> SoT 설계: `spec/5-system/4-execution-engine.md` §4/§7.1/§7.2/§7.4-7.5/§8 (2026-06-04 재정의) + `spec/0-overview.md` §2.4/§2.6.
> 본 plan 은 spec 재정의(project-planner) 이후 **developer 트랙**의 증분 구현을 추적한다. spec PR 머지 후 별 worktree 에서 착수.
> 전신: `spec-sync-execution-engine-gaps.md` §4/§7.1/§8 (forwarding 원), `execution-engine-residual-gaps.md G2`.

## consistency-check --impl-prep (2026-06-04)

BLOCK: YES (원판정) — **Critical 2건 모두 `spec/5-system/1-auth.md`(초대 에러코드 casing·WebAuthn 응답 포맷)로, execution-engine PR1 과 무관한 기존 auth spec 이슈** (`--impl-prep spec/5-system/` 광범위 scope 아티팩트; branch 가 1-auth.md 무수정 확인). exec-engine 도메인 Critical 0 + Rationale Continuity NONE → **PR1 코드 구현 차단 안 됨, 진행.** 산출: `review/consistency/2026/06/04/08_46_26/SUMMARY.md`.

후속:
- [x] **(project-planner)** execution-run 을 SoT 2곳에 등록: `spec/data-flow/0-overview.md §4`, `spec/5-system/16-system-status-api.md §1`(+§3 intake burst `waiting>0 && active===0` 오탐 note). — PR2a 반영 완료(--impl-done 15_27_55 INFO#3 "이미 등재됨 확인").
- [x] **(PR2 범위)** EIA `14-external-interaction-api.md §5.2` 예시 + `chat-channel/shared/execution-failure-classifier.ts` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 전파. — PR2a 반영 완료(W5 classifier TIMEOUT_CODES + EIA §5.2).
- **(분리·무관)** auth Critical 2건(`1-auth.md` 초대 에러코드 casing·WebAuthn) — exec-engine 무관 → **`exec-intake-followups.md` 로 이관**(별도 auth 트랙, planner 위임).

## SPEC-DRIFT 반영 (2026-06-04, ai-review #3-5 + --spec WARNING)

PR1 구현 후 spec 본문이 "Planned" 로 stale → spec §4 배너·§9.3·§11·§9.2·§11 graceful·Rationale "두 개뿐→세 개" 를 "PR1 구현됨" 으로 flip(commit 별도). `/consistency-check --spec` BLOCK:NO. §7.1/§8/우선순위 3-tier 는 Planned(PR2-4) 유지.

후속 (이번 PR 범위 외 — spec 문서 갱신, project-planner):
- [x] **`spec/data-flow/3-execution.md` §1.1 시퀀스 다이어그램 + §2.2 BullMQ 표 + `spec/data-flow/0-overview.md §4` 큐 카탈로그 + `spec/5-system/16-system-status-api.md §1` 에 `execution-run` 반영** — **완료**. `0-overview §4` + `16-system-status §1` = PR2a. `§2.2` BullMQ 표 = PR4(#798, maxStalledCount 0→1). `§1.1` 시퀀스 다이어그램 = **PR `dataflow-exec-seq` (2026-07-04)** — alt 2-way→3-way(PENDING/RUNNING stalled 재배달/terminal·WFI). §1.1 이 old in-process 였다는 진단은 이미 낡았고 실제 잔여 갭은 PR4 3-way switch 미반영이었음.

PR2 이관 (코드 — 재리뷰 사이클 회피):
- [x] **`execution-run` 을 `MONITORED_QUEUES`(system-status.constants.ts) + e2e `EXPECTED_QUEUE_NAMES` 에 등록** (--impl-done W3, "기능 영향" WARNING). — PR2a 반영 완료(W3, MONITORED 13개 + e2e 13개 기대). 9-observability mermaid 큐 카운트도 12→13 정합.

## PR1 TEST WORKFLOW (2026-06-04)

- [x] lint PASS · [x] unit PASS (전 스택; execution-engine 모듈 609/609→fix후 293) · [x] build PASS · [x] e2e PASS (168 tests)
- [x] /ai-review + resolution (risk MEDIUM, Critical 0, Warning 15 → 12 fix + 4 PR2보류 + 3 SPEC-DRIFT 반영)
- [x] /consistency-check --impl-done spec/5-system/4-execution-engine.md → **BLOCK: NO** (risk LOW, Critical 0; W1/W2 spec §4.2 정정 완료, W3 PR2 이관, W4 후속 등재)

## 증분 PR 계획

> 2026-06-04 — spec PR #458 머지됨. **PR1 착수.** 동기 caller 조사 완료: execute() 의 6개 production caller(workflows.controller·executions.service·hooks(webhook/chat)·schedule-runner·schedules.runNow) 전부 executionId 만 사용(결과 비대기) → 동기 계약 caller 없음, 큐 전환 안전. row 는 execute() 가 PENDING 저장(executionId 즉시 발급 계약 유지), 큐 job 은 executionId 만 운반, worker 가 runExecution 수행.

- [x] **PR1 — execution-run intake 큐** — **머지됨(#463, 2026-06-04)**. `execute()` fire-and-forget → `execution-run` BullMQ 큐 발행. `ExecutionRunProcessor`+`runExecutionFromQueue`. jobId=executionId, attempts:1+maxStalledCount:0, priority manual>트리거. routing 등록 worker 이동.
- **PR2 — §8 동시 실행 제한 (2026-06-04 사용자 승인 분할: PR2a→PR2b)**:
  - **PR2a — active-running 누적 타임아웃** — **PR #469 OPEN(2026-06-05)**, origin/main(#459/#462/#468) rebase + 마이그레이션 V083. (구현+TEST WORKFLOW 완료: lint·unit·build·e2e 168 ✅. impl-prep BLOCK:NO. /ai-review 2라운드: 22_44_19 Critical0/Warn6→4fix·2accept·SPEC-DRIFT 3건 반영, **09_34_16(rebase 후 재리뷰) Critical0/Warn2→W1 §8제목 fix·W2 accept**. **--impl-done 09_08_22 = BLOCK:NO, Critical/Warning 0**): `executions.active_running_ms` 컬럼(마이그레이션) + 세그먼트(execution-run/continuation) 종료 시 `now-세그먼트시작` 누적. 세그먼트 시작 시 누적>한도(기본 30분) → `EXECUTION_TIME_LIMIT_EXCEEDED`→failed. 단일 세그먼트 초과는 job 타임아웃 보강. `waiting_for_input` park 시간 제외(불변식). 곁들임: **W3**(execution-run→`MONITORED_QUEUES`+e2e `EXPECTED_QUEUE_NAMES`) · **EIA classifier**(`execution-failure-classifier.ts`+`14-eia §5.2`에 신규 코드 전파). 한도 출처는 **시스템 기본 상수(env override)** — per-workspace/workflow settings 필드는 후속(Q1=A).
    - **마이그레이션 V073 → V083 (머지 race 해소, 2026-06-05)**: 당초 V073 이 OPEN PR #459(`ai-context-memory`, V073–V078)·#462(V079)와 cross-branch 충돌. **#459/#462 가 먼저 main 머지 완료**(main 이 V073~V082 흡수, max=V082) → 본 브랜치가 후발이 되어 `migrations.md §5/§6` 절차대로 **origin/main 으로 rebase + V073 → V083(max V082+1) 재부여**. `check-migration-versions.py` OK(max V083, no gap), open PR 중 V083 점유 없음. cross-branch race 종결 — push 시 consistency-gate bypass 불요(V083 이 main 과 충돌 없음).
  - [x] **PR2b — 동시성 cap** — **cap + 5분 cancel enforcement 완료(2026-07-04, branch `claude/impl-concurrency-cap-enforce`)**: advisory-lock admission gate(TOCTOU-safe, 실 Postgres 재현 검증) + `queued_at` V104 + `EXECUTION_QUEUE_WAIT_TIMEOUT`(cancelled+timeout) + workspace settings write/read API + V105 인덱스. spec §8 구현 완료 flip. ai-review 2라운드(CRITICAL 2=TOCTOU·segmentStart→조치·재검증 RESOLVED). **priority 3-tier(triggerType threading)만 별도 후속 PR**. (아래 원 설계 노트는 참고용.) **결정(2026-06-05)**: Q-source=**settings 필드 추가**(Workspace/Workflow.settings JSONB 동시성 cap 키, 기본 fallback 10/3), Q-scope=**전체 한 PR**(cap + queue-wait 5분 cancel + TOCTOU + priority 3-tier + INFO 4건). 잠정 설계: Admission gate(`runExecutionFromQueue` RUNNING 전이 직전) — 트랜잭션 + pg advisory lock → `COUNT(status='running')` workflow/workspace → cap 미만이면 conditional `UPDATE … WHERE status='pending'`(TOCTOU#1 동시) → 아니면 job delayed 재큐; `execution.queued_at` 컬럼(마이그레이션) + 5분 초과 `CANCELLED`; priority 3-tier `ExecuteOptions.triggerType` threading.

    > **⚠️ 재결정(2026-07-04) — Q-scope 축소 (위 "전체 한 PR" superseded)**: spec §8 이 구현 착수 수준 미달(settings 키·5분 cancel 에러코드·priority 설계 미정의)로 판정 → **spec PR 분리(planner 선행)** + **스코프 = cap + 5분 cancel 먼저**(priority 3-tier=triggerType threading 은 별도 후속 PR). **spec 정의 완료(concurrency-cap spec PR, 2026-07-04)**: settings 키 `maxConcurrentExecutions`(10/3)·admission gate(consumer-side, PENDING-only)·`queued_at` V104·`EXECUTION_QUEUE_WAIT_TIMEOUT`(cancelled+`cancelledBy='timeout'`). **enforcement 구현은 후속 developer PR** — 이 항목은 그 developer PR 에서 `[x]`.
    - **✅ exec-park 후 다방면 재검토 완료 (2026-06-06, rebase + spec/code 2-agent 재검증)**: `#470/#483/#486/#494/#498/#499/#501/#502` 가 §4.x/§7.4/Rationale 를 full-durable 재전환 + in-memory 머신 완전 제거(#501 B3), `resume_call_stack`(V087) 등 추가. **판정 = (b) 부분 수정 (근본 재설계 불요)**. 핵심:
      1. **§8 cap 정책 불변** — 워크스페이스 10/워크플로 3·pending 큐대기·5분 cancel 이 spec §8(`4-execution-engine.md:983-995`)에 그대로 "Planned(PR2b)" 빈칸으로 남음.
      2. **직렬화 불변식 = 통과(강화)** — full B3 으로 "항상 BullMQ enqueue" 단일 경로. 중첩 durable resume(D6)·turn-park(D4)·retry_last_turn 모두 선형 in-process 재귀 + jobId 멱등 → 동일 Execution 동시 active 세그먼트 없음. **단 admission TOCTOU("서로 다른 Execution N건이 같은 cap race")는 직렬화 불변식과 직교한 별개 문제** — advisory lock+조건부 UPDATE 가 담당. 설계 문서에 분리 기술.
      3. **Admission 대상 한정(보강)** — gate 는 `runExecutionFromQueue`→`runExecution`(L3465 `updateExecutionStatus(RUNNING)`) 첫 세그먼트에만. continuation 재개 세그먼트(L1860/2094, 이미 running 카운트된 park→resume)·retry 재진입(L6406)은 **cap 재심사 제외**(self-deadlock 방지).
      4. **`queued_at` 신설 — 버전 재부여 필요(구 V088)** — 재활용 가능 컬럼 없음(`started_at` 은 recoverStuckExecutions stale 판정과 충돌). exec-park 컬럼(conversation_thread/user_variables/resume_call_stack)과 무충돌. **⚠️ 마이그레이션 번호 충돌**: `unified-model-management` PR1 이 V088~V091 을 이미 고정 커밋(model_config rename/kind/dimension·rerank 흡수·KB embedding FK)했으므로, 본 PR2b 의 `queued_at` 은 **V104 확정**(2026-07-04 재확인: 실제 repo max = V103, 다음 = V104. 초안의 "V092 이후" 는 그새 머지들로 stale) (`migrations.md §5/§6` renumber 절차 + `check-migration-versions.py` 확인).
      5. **settings 키 스키마 신설** — `maxConcurrentExecutions` 가 §2.2/§2.4 알려진 키(현 timezone/origins 만)에 미정의 → spec 추가. **→ 완료(2026-07-04 concurrency-cap spec PR)**: §2.2(Workspace, Admin+)·§2.4(Workflow, Editor+)에 추가.
      6. **priority 3-tier/triggerType 미구현 예약** — 상수(EXECUTION_RUN_PRIORITY manual1/webhook2/schedule3)는 있으나 execute() 는 manual/webhook 2-tier(schedule 미구분), ExecuteOptions 에 triggerType 없음 → 신규.
      - 코드 현황: runExecutionFromQueue L2820(status 재검증 L2833·runExecution L2858, firstSegmentBarrier 제거됨), segmentStartMs Map L723 잔존, ExecutionStatus.CANCELLED 존재, pg advisory lock/FOR UPDATE/RUNNING COUNT 선례 0(dataSource.transaction 만). **착수 전 fresh `--impl-prep`(post-rebase) 재실행 의무.**
    - [x] **착수 전 필수 — active-running 직렬화 불변식 재검증**(PR2a --spec INFO #10 / spec §4.2): `retry_last_turn` 등 동시 active 세그먼트가 가능해지는 재진입 경로가 추가되면 `assertActiveTimeWithinLimit`↔`updateExecutionStatus` read-check-then-act 비원자성이 실 race 로 전환될 수 있음. PR2b 가 그런 경로를 만드는지 점검 후 필요 시 원자화(잠금/조건부 UPDATE). **→ 재검토 완료(2026-06-06, exec-park 후 다방면 재검토 항목 #2)**: full B3(단일 BullMQ enqueue 경로)로 동일 Execution 동시 active 세그먼트 불가 — 직렬화 불변식 통과 확인. PR2b 의 admission gate 는 "서로 다른 Execution N건 간 cap race" 로 별개 문제(advisory lock 담당).
    - **(곁들임 PR2b) INFO 묶음**(ARCH#4/5/6·MAINT#9) → **`exec-intake-followups.md` 로 이관**(priority 3-tier·workflow cap DTO·admission 회귀 보강·orphan pending backstop 과 함께).
- [x] **PR3 — 크래시 RUNNING checkpoint 재개**: **완료(2026-07-04, `exec-park-durable-resume` 로 이관·직접 구현)**. `exec-park-durable-resume.md` "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개" 참조. 스코핑 재확정: "rehydration 일반화(ai_agent→일반 노드)" 축은 full B3 로 이미 완료였고, 실제 갭 = **크래시/재시작 RUNNING(non-waiting) 세그먼트의 §7.5 case B re-drive**(`recoverStuckExecutions` fail→re-claim+rehydrate+forward, `skipExecutedNodes` 멱등 가드). BullMQ auto-stalled 재배달은 PR4 유지(사용자 Q1). errorPolicy=continue 는 defer(Q2, G2). 직렬화 순서(B3 선행) 확정대로. spec §7.1/§7.2/§7.3/§7.5 갱신 완료.
- [x] **PR4 — stalled-job 자동 재배달 + 관측성**: **완료(2026-07-04, branch `claude/exec-intake-pr4-stalled`)**. `execution-run` `maxStalledCount:0→1` + `stalledInterval:30s` → 크래시 세그먼트를 같은 jobId 로 1회 자동 재배달 → `runExecutionFromQueue` 3-way switch 의 RUNNING 분기가 §7.5 case B 재구동. `finalizeStalledExhausted`(stalled 소진 → `WORKER_HEARTBEAT_TIMEOUT` 조건부 마감 + 자식 cascade). `recoverStuckExecutions` 는 은퇴 아닌 **부팅 backstop 병존**(F1 — 전체 재시작·Redis 비영속·job 유실). 네이티브 stalled=같은 jobId 라 `exec:run:seq` 미사용(seq 스케치 정정). `ExecutionRunDlqMonitorService`(continuation 미러) 관측. Q2 defer(segment-start 영속 미도입, migration-free). spec flip 5파일 + consistency-check(--spec/--impl-done BLOCK:NO) + /ai-review(Critical 0, Warning 5 조치). TEST: lint·unit(7573)·build·e2e(228) 통과.

### PR4 스코핑 확정 (2-agent 조사 + 사용자 결정 2026-07-04)
**가치**: 운영 중 워커 크래시를 재시작 없이 즉시 인계(멀티인스턴스 HA). feasible — PR3 재구동 머신 + KB `graph-extraction.processor`(stalledInterval:30s) 선례 + `ContinuationDlqMonitorService` 패턴 + spec 배너 준비됨.

**사용자 결정**: (Q1) **진행 (bounded)** — 자동 재배달 on, maxStalledCount 작게(1)로 poison blast radius bound, at-least-once=PR3 동일 모델(Integration 멱등=노드 책임). (Q2) **segment-start 영속 defer** — under-count 는 수용된 trade-off, PR4 는 마이그레이션 0.

**설계**:
1. **native stalled 채택 (핵심 단순화)**: `<executionId>:run:<seq>` re-enqueue 불요 — BullMQ 가 stalled job 을 **같은 jobId 로 재처리**. §9.2 `exec:run:seq` 는 미사용 유지(native stalled 은 seq 불요).
2. `execution-run.queue.ts`: `EXECUTION_RUN_MAX_STALLED_COUNT 0→1`. `attempts:1`·`removeOnFail:false` 유지.
3. `execution-run.processor.ts`: `@Processor` 에 `stalledInterval:30_000` 추가(KB 패턴). `onFailed`(stalled 소진 dead-letter): Execution 이 아직 RUNNING 이면 `failed`+`WORKER_HEARTBEAT_TIMEOUT` 마킹(현재는 로그만).
4. **`runExecutionFromQueue` 3-way 전환 (핵심 통합점, 현재 갭)**: `status!==PENDING→ack-discard` 이분 → PENDING→정상 / **RUNNING→`await redriveStuckExecution`**(stalled 재배달=크래시 세그먼트 재구동, PR3 재사용) / terminal·WAITING→discard.
5. **F1 — recoverStuckExecutions=backstop(은퇴 아님)**: 전체 재시작·Redis 비영속·job 유실 케이스엔 stalled job 부재 → DB 부팅 스캔만 복구. 축소 유지(KB `stuck-document-recovery` 선례). spec "은퇴"→"backstop" 정정.
6. **F2 — fence**: BullMQ job lock(lockDuration)이 동시 처리 차단 = 주 fence. zombie(hung 워커) side-effect 이중발화는 at-least-once 수용 경계 + maxStalledCount:1 bound + PR3 skipExecutedNodes/failOrphan 로 DB 이중구동 방어. 신규 claim 불요.
7. **execution-run DLQ 모니터**: `ContinuationDlqMonitorService` 일반화/복제(현재 continuation 전용). stalled-소진 failed job depth 관측.
8. **spec flip**: §7.1/§7.2 PR4 Planned→구현, §9.3 maxStalledCount, §2.13, Rationale(WORKER_HEARTBEAT_TIMEOUT 재정의·recoverStuckExecutions backstop). `execution-engine.service.spec.ts` "WORKER_HEARTBEAT_TIMEOUT 미발동" 가드 테스트 revise(stalled-소진 경로 발동).

**F3 (PR2b 순서)**: PR4 의 3-way switch 가 `runExecutionFromQueue` 에 먼저 랜딩 → PR2b admission gate 는 PENDING arm 에 slot(RUNNING re-drive arm 은 cap 재심사 skip). PR4 선행 권장.

**F5 (defer 확정)**: segment-start 영속 = 별도 후속 candidate.

**e2e**: 실 BullMQ stall 타이밍 재현은 어려우므로, PR3 의 `_test/` 훅 패턴으로 stalled 재배달 시뮬(RUNNING execution 에 대해 `runExecutionFromQueue` 직접 호출) → 3-way switch RUNNING→re-drive 무손실 completed 검증. maxStalledCount/onFailed 는 unit.

## 불변식 (구현 전 구간 유지)

- `waiting_for_input` 은 **큐 없는 durable DB park** — 재큐·TTL·만료·stalled 대상 절대 아님. 오직 사용자 인터랙션이 continuation job 을 만들어 재개.
- 복구/재큐/타임아웃은 **RUNNING active 세그먼트 한정**. 타임아웃은 active-running 시간 기준(wait 제외).
- 한 세그먼트 내부 노드 dispatch 는 in-process — per-node task queue 도입 금지.

## G2 관계 (execution-engine-residual-gaps.md)

`execution-engine-residual-gaps.md G2`("cross-instance 재개 인프라 부재")는 PR3 의 크래시 RUNNING 세그먼트 re-drive(§7.5 case B) + rehydration 으로 **부분 해소**된다(2026-07-04 완료). 단 `errorPolicy='continue'` 분기에서의 세그먼트 재개 설계는 **defer 확정**(사용자 Q2, 2026-07-03) — G2 장애물 1·2(errorPolicy schema 노출·용어 매핑)는 별건으로 남는다.
