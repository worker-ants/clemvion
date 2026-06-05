---
worktree: impl-exec-concurrency-cap
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
- [x] **(project-planner)** execution-run 을 SoT 2곳에 등록: `spec/data-flow/0-overview.md §4`, `spec/5-system/16-system-status-api.md §1`(+§3 intake burst `waiting>0 && active===0` 오탐 note). — PR2a 반영 완료(--impl-done 15_27_55 INFO#3 "이미 등재됨 확인").
- [x] **(PR2 범위)** EIA `14-external-interaction-api.md §5.2` 예시 + `chat-channel/shared/execution-failure-classifier.ts` 에 `EXECUTION_TIME_LIMIT_EXCEEDED` 전파. — PR2a 반영 완료(W5 classifier TIMEOUT_CODES + EIA §5.2).
- [ ] **(분리·무관)** auth Critical 2건은 본 작업과 무관 — 별도 항목으로 사용자/planner 위임.

## SPEC-DRIFT 반영 (2026-06-04, ai-review #3-5 + --spec WARNING)

PR1 구현 후 spec 본문이 "Planned" 로 stale → spec §4 배너·§9.3·§11·§9.2·§11 graceful·Rationale "두 개뿐→세 개" 를 "PR1 구현됨" 으로 flip(commit 별도). `/consistency-check --spec` BLOCK:NO. §7.1/§8/우선순위 3-tier 는 Planned(PR2-4) 유지.

후속 (이번 PR 범위 외 — spec 문서 갱신, project-planner):
- [~] **`spec/data-flow/3-execution.md` §1.1 시퀀스 다이어그램 + §2.2 BullMQ 표 + `spec/data-flow/0-overview.md §4` 큐 카탈로그 + `spec/5-system/16-system-status-api.md §1` 에 `execution-run` 반영** — 현재 old in-process 흐름 기술. mermaid 포함 (--spec W1/#2, --impl-done W4). **부분완료**: `0-overview §4` + `16-system-status §1` 은 PR2a 반영 완료. **잔여**: `3-execution.md §1.1/§2.2` mermaid 갱신(project-planner 후속, 본 PR 범위 외).

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
  - **PR2a — active-running 누적 타임아웃** (구현+TEST WORKFLOW 완료: lint·unit·build·e2e 168 ✅. impl-prep BLOCK:NO. /ai-review Critical0/Warn11→fix. **--impl-done 15_27_55 = spec-impl 정합 Critical 0**): `executions.active_running_ms` 컬럼(마이그레이션) + 세그먼트(execution-run/continuation) 종료 시 `now-세그먼트시작` 누적. 세그먼트 시작 시 누적>한도(기본 30분) → `EXECUTION_TIME_LIMIT_EXCEEDED`→failed. 단일 세그먼트 초과는 job 타임아웃 보강. `waiting_for_input` park 시간 제외(불변식). 곁들임: **W3**(execution-run→`MONITORED_QUEUES`+e2e `EXPECTED_QUEUE_NAMES`) · **EIA classifier**(`execution-failure-classifier.ts`+`14-eia §5.2`에 신규 코드 전파). 한도 출처는 **시스템 기본 상수(env override)** — per-workspace/workflow settings 필드는 후속(Q1=A).
    - **마이그레이션 V073 → V083 (머지 race 해소, 2026-06-05)**: 당초 V073 이 OPEN PR #459(`ai-context-memory`, V073–V078)·#462(V079)와 cross-branch 충돌. **#459/#462 가 먼저 main 머지 완료**(main 이 V073~V082 흡수, max=V082) → 본 브랜치가 후발이 되어 `migrations.md §5/§6` 절차대로 **origin/main 으로 rebase + V073 → V083(max V082+1) 재부여**. `check-migration-versions.py` OK(max V083, no gap), open PR 중 V083 점유 없음. cross-branch race 종결 — push 시 consistency-gate bypass 불요(V083 이 main 과 충돌 없음).
  - [ ] **PR2b — 동시성 cap**: 워크스페이스 10/워크플로 3 동시 RUNNING 제한. **worker 가 pending→running 전이 직전 DB count 확인**(workflow→workspace 조인) + 트랜잭션/`FOR UPDATE` 원자화(Q2=A). 초과 시 job delayed 재큐, 누적 대기 5분 초과 cancelled. **TOCTOU(#1)** 원자화도 이 전이 로직과 함께. priority 3-tier(triggerType threading)는 PR2a 곁들임 또는 여기.
    - [ ] **착수 전 필수 — active-running 직렬화 불변식 재검증**(PR2a --spec INFO #10 / spec §4.2): `retry_last_turn` 등 동시 active 세그먼트가 가능해지는 재진입 경로가 추가되면 `assertActiveTimeWithinLimit`↔`updateExecutionStatus` read-check-then-act 비원자성이 실 race 로 전환될 수 있음. PR2b 가 그런 경로를 만드는지 점검 후 필요 시 원자화(잠금/조건부 UPDATE).
    - [ ] (곁들임 PR2b) INFO 묶음: `resolveExecutionRunWorkerConcurrency`→`execution-limits.ts` 통합(ARCH#4), `error-codes.ts` 엔진 에러코드 레이어 분리(ARCH#5), `execution-limits.ts` 모듈 경계 JSDoc(ARCH#6), `system-status.constants.ts` concurrency 파싱 일원화(MAINT#9).
- [ ] **PR3 — 크래시 RUNNING checkpoint 재개**: stalled active 세그먼트를 §7.5 rehydration 으로 재개. rehydration 을 `ai_agent` 너머 일반 노드로 확장. 멱등성: jobId(§7.3)·`NodeExecution.status` 재검증(§7.5)·완료 노드 미재실행(§7.2). **`node-cancellation-infrastructure.md §2` 와 코드영역 겹침 → 직렬화 순서**: cancellation 인프라 선/후행을 PR3 착수 시 확정.
- [ ] **PR4 — stalled-job 일원화 + 관측성**: `recoverStuckExecutions` 절대 30분 일괄 fail → BullMQ stalled 재배달로 대체. `WORKER_HEARTBEAT_TIMEOUT` 의미 재정의(stalled attempts 소진). `waiting_for_input` 무관 보장 재확인. DLQ/관측성 정리.

## 불변식 (구현 전 구간 유지)

- `waiting_for_input` 은 **큐 없는 durable DB park** — 재큐·TTL·만료·stalled 대상 절대 아님. 오직 사용자 인터랙션이 continuation job 을 만들어 재개.
- 복구/재큐/타임아웃은 **RUNNING active 세그먼트 한정**. 타임아웃은 active-running 시간 기준(wait 제외).
- 한 세그먼트 내부 노드 dispatch 는 in-process — per-node task queue 도입 금지.

## G2 관계 (execution-engine-residual-gaps.md)

`execution-engine-residual-gaps.md G2`("cross-instance 재개 인프라 부재")는 PR3 의 stalled active 세그먼트 재배달 + rehydration 으로 **부분 해소**된다. 단 `errorPolicy='continue'` 분기에서의 세그먼트 재개 설계는 별도 미해결 — PR3 에서 범위 확정.
