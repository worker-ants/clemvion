---
worktree: (구현 시 신설 — 본 plan 은 spec-exec-intake-queue worktree 에서 생성됨)
started: 2026-06-04
owner: developer (예정)
---

# 구현 추적 — 실행엔진 분산: execution-level intake 큐

> SoT 설계: `spec/5-system/4-execution-engine.md` §4/§7.1/§7.2/§7.4-7.5/§8 (2026-06-04 재정의) + `spec/0-overview.md` §2.4/§2.6.
> 본 plan 은 spec 재정의(project-planner) 이후 **developer 트랙**의 증분 구현을 추적한다. spec PR 머지 후 별 worktree 에서 착수.
> 전신: `spec-sync-execution-engine-gaps.md` §4/§7.1/§8 (forwarding 원), `execution-engine-residual-gaps.md G2`.

## 증분 PR 계획

- [ ] **PR1 — execution-run intake 큐**: `execute()` 를 fire-and-forget in-process `runResolution` → `execution-run` BullMQ 큐 발행(즉시 반환·비동기)으로 전환. `@Processor(execution-run)` 가 `runExecution` 호출. `EXECUTION_RUN_WORKER_CONCURRENCY` env. jobId `<executionId>:run:<seq>` (`exec:run:seq:<executionId>` INCR). BullMQ job priority `manual`>`webhook`>`schedule`. **선결: 동기 caller 식별** — `execute()` 를 인라인 await 해 결과 즉시 반환하는 호출자(REST API·chat-channel·EIA)를 찾아 (a) WS/SSE/이벤트 비동기 전환 또는 (b) inline job 완료 await 보전. 결과 silent drop 금지. waiting/resume 로직 무변경.
- [ ] **PR2 — §8 동시성 cap + active-running 타임아웃**: 워크스페이스 10·워크플로 3 동시 Execution 카운트 가드(intake 큐 + DB count). 누적 active-running 타임아웃 → `EXECUTION_TIME_LIMIT_EXCEEDED`(세그먼트 active 시간 합산, wait 제외). 큐 대기 5분 cancel.
- [ ] **PR3 — 크래시 RUNNING checkpoint 재개**: stalled active 세그먼트를 §7.5 rehydration 으로 재개. rehydration 을 `ai_agent` 너머 일반 노드로 확장. 멱등성: jobId(§7.3)·`NodeExecution.status` 재검증(§7.5)·완료 노드 미재실행(§7.2). **`node-cancellation-infrastructure.md §2` 와 코드영역 겹침 → 직렬화 순서**: cancellation 인프라 선/후행을 PR3 착수 시 확정.
- [ ] **PR4 — stalled-job 일원화 + 관측성**: `recoverStuckExecutions` 절대 30분 일괄 fail → BullMQ stalled 재배달로 대체. `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의(stalled attempts 소진). `waiting_for_input` 무관 보장 재확인. DLQ/관측성 정리.

## 불변식 (구현 전 구간 유지)

- `waiting_for_input` 은 **큐 없는 durable DB park** — 재큐·TTL·만료·stalled 대상 절대 아님. 오직 사용자 인터랙션이 continuation job 을 만들어 재개.
- 복구/재큐/타임아웃은 **RUNNING active 세그먼트 한정**. 타임아웃은 active-running 시간 기준(wait 제외).
- 한 세그먼트 내부 노드 dispatch 는 in-process — per-node task queue 도입 금지.

## G2 관계 (execution-engine-residual-gaps.md)

`execution-engine-residual-gaps.md G2`("cross-instance 재개 인프라 부재")는 PR3 의 stalled active 세그먼트 재배달 + rehydration 으로 **부분 해소**된다. 단 `errorPolicy='continue'` 분기에서의 세그먼트 재개 설계는 별도 미해결 — PR3 에서 범위 확정.
