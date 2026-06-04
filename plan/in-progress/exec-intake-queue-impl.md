---
worktree: impl-exec-intake-queue
started: 2026-06-04
owner: developer
---

# 구현 추적 — 실행엔진 분산: execution-level intake 큐

> SoT 설계: `spec/5-system/4-execution-engine.md` §4/§7.1/§7.2/§7.4-7.5/§8 (2026-06-04 재정의) + `spec/0-overview.md` §2.4/§2.6.
> 본 plan 은 spec 재정의(project-planner) 이후 **developer 트랙**의 증분 구현을 추적한다. spec PR 머지 후 별 worktree 에서 착수.
> 전신: `spec-sync-execution-engine-gaps.md` §4/§7.1/§8 (forwarding 원), `execution-engine-residual-gaps.md G2`.

## consistency-check --impl-prep (2026-06-04)

BLOCK: YES (원판정) — **Critical 2건 모두 `spec/5-system/1-auth.md`(초대 에러코드 casing·WebAuthn 응답 포맷)로, execution-engine PR1 과 무관한 기존 auth spec 이슈** (`--impl-prep spec/5-system/` 광범위 scope 아티팩트; branch 가 1-auth.md 무수정 확인). exec-engine 도메인 Critical 0 + Rationale Continuity NONE → **PR1 코드 구현 차단 안 됨, 진행.** 산출: `review/consistency/2026/06/04/08_46_26/SUMMARY.md`.

후속:
- [ ] **(project-planner)** execution-run 을 SoT 2곳에 등록: `spec/data-flow/0-overview.md §4`, `spec/5-system/16-system-status-api.md §1`(+§3 intake burst `waiting>0 && active===0` 오탐 note). #458 이 §2.4/§2.6/§9.3/§11 은 반영했으나 이 2곳 누락.
- [ ] **(PR2 범위)** EIA `14-external-interaction-api.md §5.2` 예시 + `chat-channel/shared/execution-failure-classifier.ts` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 전파.
- [ ] **(분리·무관)** auth Critical 2건은 본 작업과 무관 — 별도 항목으로 사용자/planner 위임.

## PR1 TEST WORKFLOW (2026-06-04)

- [x] lint PASS · [x] unit PASS (전 스택; execution-engine 모듈 609/609) · [x] build PASS · [x] e2e PASS (168 tests — execution 시작이 실제 execution-run 큐+worker 경유해도 webhook/schedule/re-run/chat-channel 전부 통과)
- [ ] /ai-review + resolution
- [ ] /consistency-check --impl-done spec/5-system/ (spec 연결 코드 변경 → 의무·push-gated)

## 증분 PR 계획

> 2026-06-04 — spec PR #458 머지됨. **PR1 착수.** 동기 caller 조사 완료: execute() 의 6개 production caller(workflows.controller·executions.service·hooks(webhook/chat)·schedule-runner·schedules.runNow) 전부 executionId 만 사용(결과 비대기) → 동기 계약 caller 없음, 큐 전환 안전. row 는 execute() 가 PENDING 저장(executionId 즉시 발급 계약 유지), 큐 job 은 executionId 만 운반, worker 가 runExecution 수행.

- [~] **PR1 — execution-run intake 큐** (구현+유닛 완료, TEST WORKFLOW 진행): `execute()` 를 fire-and-forget in-process → `execution-run` BullMQ 큐 발행(즉시 반환)으로 전환. `ExecutionRunProcessor` 가 `runExecutionFromQueue`(row 재조회→status 재검증→routing 재등록→runExecution) 호출. `EXECUTION_RUN_WORKER_CONCURRENCY` env. **jobId = executionId** (1:1 enqueue dedup — spec 의 `:run:<seq>` 는 향후 re-enqueue 용 일반형, PR1 불요). priority: **manual > 트리거**(webhook/schedule 세부 3-tier 는 ExecuteOptions 가 trigger type 미보유 → 후속). attempts:1 + maxStalledCount:0 (crash-retry 미도입, PR3/4). routing 등록을 worker 로 이동(work-stealing 시 실행 인스턴스에서 등록↔terminal release 짝). 동기 caller 0건 확인. 신규: `queues/execution-run.queue.ts`·`.processor.ts`(+spec). 유닛: execution-engine 모듈 609/609 통과(인라인 worker 브릿지로 기존 execute() 테스트 계약 보존).
- [ ] **PR2 — §8 동시성 cap + active-running 타임아웃**: 워크스페이스 10·워크플로 3 동시 Execution 카운트 가드(intake 큐 + DB count). 누적 active-running 타임아웃 → `EXECUTION_TIME_LIMIT_EXCEEDED`(세그먼트 active 시간 합산, wait 제외). 큐 대기 5분 cancel.
- [ ] **PR3 — 크래시 RUNNING checkpoint 재개**: stalled active 세그먼트를 §7.5 rehydration 으로 재개. rehydration 을 `ai_agent` 너머 일반 노드로 확장. 멱등성: jobId(§7.3)·`NodeExecution.status` 재검증(§7.5)·완료 노드 미재실행(§7.2). **`node-cancellation-infrastructure.md §2` 와 코드영역 겹침 → 직렬화 순서**: cancellation 인프라 선/후행을 PR3 착수 시 확정.
- [ ] **PR4 — stalled-job 일원화 + 관측성**: `recoverStuckExecutions` 절대 30분 일괄 fail → BullMQ stalled 재배달로 대체. `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의(stalled attempts 소진). `waiting_for_input` 무관 보장 재확인. DLQ/관측성 정리.

## 불변식 (구현 전 구간 유지)

- `waiting_for_input` 은 **큐 없는 durable DB park** — 재큐·TTL·만료·stalled 대상 절대 아님. 오직 사용자 인터랙션이 continuation job 을 만들어 재개.
- 복구/재큐/타임아웃은 **RUNNING active 세그먼트 한정**. 타임아웃은 active-running 시간 기준(wait 제외).
- 한 세그먼트 내부 노드 dispatch 는 in-process — per-node task queue 도입 금지.

## G2 관계 (execution-engine-residual-gaps.md)

`execution-engine-residual-gaps.md G2`("cross-instance 재개 인프라 부재")는 PR3 의 stalled active 세그먼트 재배달 + rehydration 으로 **부분 해소**된다. 단 `errorPolicy='continue'` 분기에서의 세그먼트 재개 설계는 별도 미해결 — PR3 에서 범위 확정.
