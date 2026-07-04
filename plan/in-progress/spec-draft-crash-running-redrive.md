---
worktree: exec-park-durable-resume
started: 2026-07-03
owner: project-planner
---

# Spec draft — 크래시/재시작 RUNNING 세그먼트 제어된 re-drive (PR3)

> 대상: `spec/5-system/4-execution-engine.md` §7.1 / §7.2 / §7.3 / §7.5 + Rationale.
> 근거 스코핑: `plan/in-progress/exec-park-durable-resume.md` "## PR3 — 크래시 RUNNING 세그먼트 멱등 재개 (스코핑 확정 2026-07-03)". 사용자 결정 Q1=제어된 re-drive(BullMQ auto-stalled OFF), Q2=errorPolicy=continue defer.
> consistency-check --spec 대상 draft. **BLOCK:NO 확인 (2026-07-04, `review/consistency/2026/07/03/23_50_01`) → 실제 spec 반영 완료.** W1(§4.2 재검증)·W2(error-code 단일화)·W3(data-flow 동시 갱신)·W4(active_running_ms under-count 정직화) 모두 반영. INFO 문서 동기화(error-codes·3-error-handling·1-data-model·§4.1 jobId·§7.4 lock) 완료.

## 변경 핵심 (한 줄)

`recoverStuckExecutions` 가 stale RUNNING(non-waiting) 세그먼트를 **즉시 `failed`** 처리하던 것을, **원자 re-claim + §7.5 rehydration 재구동(forward)** 으로 전환해 §7.2 point 3("전체 Engine 재시작 시 running Execution 을 마지막 체크포인트에서 resume")을 **일반 노드 대상으로 실제 구현**한다. BullMQ stalled-job 자동 재배달(mid-operation 크래시 검출, §7.2 point 2)은 **PR4 로 유지(Planned)**.

## Δ1 — §7.1 워커 크래시 복구

현행 banner("현 실제 동작: recoverStuckExecutions 가 stale RUNNING 을 일괄 failed 마킹")를 다음으로 개정:

- **현 실제 동작 (PR3 반영)**: 서버 부팅 시 `recoverStuckExecutions()` 가 `status='running' AND started_at < now() - STUCK_RECOVERY_STALE_MS(30분)` 인 Execution 을 발견하면, **일괄 `failed` 가 아니라** 각 row 를 **원자 re-claim**(`UPDATE … SET started_at=now() WHERE status='running' AND started_at < :threshold RETURNING`; affected=1 인 인스턴스만 소유) 한 뒤 **§7.5 rehydration 으로 재구동**(rehydrate + 완료 노드 이후부터 `runNodeDispatchLoop` forward)한다. 이는 §7.2 point 3(재시작 resume)의 일반 노드 구현이다.
- **BullMQ stalled-job 자동 재배달**(§7.2 point 2, mid-operation 크래시를 다른 워커가 이어받음)은 여전히 **Planned(PR4)** — `execution-run` 큐는 `maxStalledCount: 0` / `attempts: 1` 유지. **interim/재시작 트리거 = recovery loop(부팅 시)**. 따라서 운영 중(재시작 없이) 크래시한 세그먼트는 다음 부팅 또는 30분 stale 검출 시 re-drive 되며, 그때까지 RUNNING 잔류(무손실 — 데이터는 durable).
- **terminal 경계(무한 re-drive 방지)**: 재구동이 반복 실패하는 poison 세그먼트는 **attempts 카운터가 아니라 §8 누적 active-running 한도**(`EXECUTION_MAX_ACTIVE_RUNNING_MS`, 기본 30분)로 종결된다 — 매 re-drive 세그먼트가 `active_running_ms` 를 누적하고, 세그먼트 시작 시 누적>한도면 `EXECUTION_TIME_LIMIT_EXCEEDED`→`failed`(§8). 신규 컬럼/마이그레이션 불요.
- **rehydration 불가 케이스**: checkpoint(`execution_node_log`/`NodeExecution.outputData`) 부재·손상으로 재구동 자체가 불가하면 §7.5 "Rehydration 실패 케이스"의 `RESUME_CHECKPOINT_MISSING` terminal(Execution `cancelled` + NodeExecution `failed`).

§7.1 표 갱신:
- "미응답 시 동작" 행: "stalled job 을 다른 워커에 재배달 → §7.5 rehydration" 을 **target(PR4)** 로 표기 유지하되, "**현재: 재시작 시 recovery loop re-claim → §7.5 rehydration 재구동(일반 노드)**" 행 추가.
- "attempts 소진 (terminal)" 행: 현행 "stalled 재배달 소진 → failed(WORKER_HEARTBEAT_TIMEOUT)" 은 **PR4 stalled 모델의 terminal** 로 남기고, **PR3 현행 terminal = §8 누적 active-running 한도 초과 → `EXECUTION_TIME_LIMIT_EXCEEDED` failed** 를 병기. (재시작 re-drive 는 무한이 아니라 §8 로 bounded.)

> `WORKER_HEARTBEAT_TIMEOUT` 코드는 **유지·의미 축소**: 이제 "stale RUNNING 일괄 fail" 이 아니라 "**재구동조차 불가/한도 초과로 종결된 잔여**" 표기에만 쓰인다. (§2.13 `errorCode` 어휘 무변경 — 문자열 그대로.)

## Δ2 — §7.2 체크포인트 기반 Resume

point 3 을 **구현됨**으로 승격하고 일반 노드 재구동 절차를 명시:

```
3. 전체 Execution Engine 재시작 시 (PR3 — 구현):
   a. status='running' AND stale(>30분) 인 Execution 을 원자 re-claim
   b. 각 Execution 을 §7.5 rehydration 으로 재구동:
      - rehydrateContext 가 execution_node_log(같은 executionId 타임라인)로
        _executedNodes Set + 완료 노드 outputData 를 복원 (node-type 무관)
      - 도착 payload 없음(waiting 재개와 구분) — runNodeDispatchLoop 를
        마지막 완료 노드 이후부터 forward
   c. 완료 노드는 재실행하지 않음 (executedNodes 기준 — §7.2 멱등)
   d. 크래시 시점 RUNNING-at-crash(미완료) 노드는 재실행됨 — at-least-once (§7.3)
```

- **일반화(핵심)**: 재구동은 `ai_agent` 한정이 아니라 **임의 노드 타입**을 커버한다 — `rehydrateContext`·`runNodeDispatchLoop` 는 이미 node-type-generic. waiting 노드 재개(§7.5, `dispatchResumeTurn`)와 달리 **turn 핸들러/도착 payload 를 거치지 않고** 곧장 그래프 forward.
- point 2(mid-operation stalled 재배달)는 `> 구현 상태 — Planned(PR4)` banner 유지.

## Δ3 — §7.3 멱등성 보장

현행 3줄(taskId 중복 확인 / Integration 노드 설정 멱등)을 다음으로 정밀화:

- **jobId 멱등** (§7.4): active 세그먼트 job 은 `jobId=executionId`(execution-run) / `executionId:nodeExecutionId:seq`(continuation) 로 BullMQ dedup.
- **완료 노드 미재실행** (엔진 보장): 재구동/재개 시 `execution_node_log` + 완료 `NodeExecution.outputData` 로 복원한 `_executedNodes` 로 완료 노드를 skip. 재방문 금지(§7.2).
- **재개 진입 원자 claim**: waiting 재개는 `waiting_for_input → running`(claimResumeEntry), **재시작 re-drive 는 `running → running` started_at 조건부 re-claim**(§7.1/§7.5) — 둘 다 affected=1 인 worker/인스턴스만 진행.
- **per-node DB status 재검증** (defense-in-depth): dispatch 직전 대상 NodeExecution 이 이미 COMPLETED 면 skip. in-memory `_executedNodes` 와 중복 방어.
- **RUNNING-at-crash 노드 = at-least-once**: 크래시 시점 아직 COMPLETED 아니던 노드는 재구동 시 **재실행**된다. 그 노드의 외부 side-effect(Integration write: send_email·HTTP POST 등) 발생 여부는 엔진이 알 수 없으므로 **exactly-once 를 보장하지 않는다** — Integration 멱등은 기존 원칙대로 **노드 설정 책임**(idempotency key 등). 엔진은 "완료 노드 미재실행"까지만 보장한다.

## Δ4 — §7.5 Resume after Restart (rehydration)

§7.5 는 현재 "WAITING_FOR_INPUT + 사용자 입력 도착" 단일 트리거로 서술돼 있다. **두 진입 트리거**로 일반화:

- **case A — waiting 노드 재개 (기존)**: 사용자 입력이 도착 → `waiting_for_input → running` 원자 claim(`claimResumeEntry`) → rehydrate → `dispatchResumeTurn`(form/button/ai turn 핸들러) → forward.
- **case B — 크래시/재시작 RUNNING 세그먼트 re-drive (PR3, 신규)**: 도착 payload·waiting 노드 **없음**. `recoverStuckExecutions` 가 stale RUNNING 을 `running → running` started_at 조건부 re-claim(affected=1) → rehydrate(`rehydrateContext`) → **turn 핸들러 우회**, `runNodeDispatchLoop` 를 마지막 완료 노드 이후부터 forward. 중간에 새 blocking 노드 도달 시 정상 park(§4.x)로 세그먼트 종료.

- **"Rehydration 멱등성" 소절 확장**: 기존 waiting claim(`waiting_for_input → running`) 서술에, case B 의 **`running → running` started_at 조건부 re-claim**(중복 re-drive 방지 — 두 인스턴스가 같은 stale row 를 동시에 잡아도 affected=1 인 쪽만)을 병기. 둘 다 §1.3 `_retryState` "affected=1 인 쪽만 진행" 패턴의 일반화.
- **"Rehydration 실패 케이스" 표**: case B 에도 동일 적용 — checkpoint 부재/손상 → `RESUME_CHECKPOINT_MISSING`; 단 case B 는 도착 payload 가 없으므로 `_resumeCheckpoint`(멀티턴 AI turn-state) 미해당 노드가 대다수 → `RESUME_INCOMPATIBLE_STATE` 는 case B 에서 멀티턴 AI 가 크래시 세그먼트에 걸린 경우에 한정.
- **§1.1 원자성**: case B 의 `running → running` re-claim 은 상태 enum 변화가 아니라 소유권 이전(started_at 갱신)이므로 §1.1 전이표 무변경. claim 후 재구동 실패는 case A 와 동일하게 `RESUME_*` terminal 원자 마감(**claim 후 `running` 잔류 금지**).

## Δ5 — Rationale 신규 항목: "크래시/재시작 RUNNING 세그먼트 제어된 re-drive (§7.1/§7.2, PR3, 2026-07-03)"

- **왜 지금 recovery-loop re-drive 인가**: §7.2 point 3 은 "재시작 시 running 을 체크포인트에서 resume" 을 이미 약속했으나, `recoverStuckExecutions` 가 정반대로 **일괄 fail** 해 약속을 위반했다. PR3 는 이 위반을 해소한다 — fail→re-drive. 일반 노드로의 "일반화" 는 이미 full B3 로 완료된 waiting 재개(`dispatchResumeTurn`)와 달리, **크래시 세그먼트는 waiting 이 아니라 mid-dispatch RUNNING** 이므로 turn 핸들러가 아닌 그래프 forward 재구동이 필요했고, `rehydrateContext`/`runNodeDispatchLoop` 가 node-type-generic 이라 tractable.
- **왜 BullMQ stalled 자동 재배달을 지금 켜지 않는가 (PR4 로 분리)**: `maxStalledCount>0` 자동 재배달은 **poison/non-idempotent 세그먼트를 운영 중 무인 재실행**시켜, RUNNING-at-crash Integration 노드의 중복 side-effect 를 자동 증폭할 위험이 있다. 제어된 트리거(recovery loop, 부팅/30분 stale)로 먼저 landing 해 멱등 재구동 메커니즘·경계를 검증하고, 자동 재배달·`recoverStuckExecutions` 완전 대체는 PR4 에서 관측성과 함께 도입한다. (사용자 결정 Q1, 2026-07-03.)
- **신규 마이그레이션 불요**: re-claim 은 기존 `started_at`(recoverStuckExecutions stale 판정과 동일 컬럼) 조건부 UPDATE, 완료 노드 skip 은 기존 `execution_node_log`(V035/V036), terminal 경계는 §8 `active_running_ms`(V083) 재사용.
- **at-least-once 경계**: 엔진은 완료 노드 미재실행(exactly-once)만 보장하고, RUNNING-at-crash 노드는 at-least-once 로 재실행한다. 이는 §7.3 이 Integration 멱등을 노드 설정에 위임하는 기존 모델과 정합이며, 크래시 복구의 본질적 trade-off(중복 실행 없이 무손실 재개는 분산 트랜잭션 없이 불가)다.
- **errorPolicy='continue' 세그먼트 재개는 분리(defer)**: `execution-engine-residual-gaps.md` G2 의 3중 장애물(errorPolicy schema 노출 선행 미충족·spec 'continue' 용어가 실제 enum 에 부재·cross-instance mid-execution 재개 인프라)은 크래시-재구동 인프라와 직교 — PR3 는 인프라 토대(멱등 re-drive)를 제공하되 G2 자체는 별건으로 남긴다. (사용자 결정 Q2, 2026-07-03.)
- **기각 대안**: (a) 신규 owner/heartbeat 컬럼으로 정확한 크래시 검출 — 마이그레이션·heartbeat 인프라 비용이 크고 BullMQ stalled 가 같은 역할을 이미 표준 제공하므로 PR4 stalled 로 흡수. (b) recovery loop 주기적 스캔 추가 — 부팅 트리거로 재시작 resume 은 성립하고, 운영 중 크래시는 PR4 stalled 가 본령이라 범위 밖.

## side-effect 점검 대상 (반영 시)

- `spec/data-flow/3-execution.md` §1.x(재시작 resume 서술) — 크래시 fail→re-drive 정합 확인(필요 시 planner 후속).
- `spec/5-system/4-execution-engine.md` §7.4 Rationale L1372(graceful shutdown under-count) 의 "stalled-job(§7.1) 재배달" 참조 — PR4 stalled 문맥이므로 무변경, 단 §7.1 개정과 모순 없는지 확인.
- `plan/in-progress/exec-intake-queue-impl.md` PR3(L57)·PR4(L58) 상태 표기 — developer 단계에서 갱신.
- `plan/in-progress/execution-engine-residual-gaps.md` G2 — PR3 부분 해소(인프라 토대) 표기.
