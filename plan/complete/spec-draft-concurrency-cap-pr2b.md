---
worktree: impl-concurrency-cap-pr2b-0f2616
started: 2026-07-04
owner: project-planner
spec_impact:
  - spec/5-system/4-execution-engine.md
  - spec/1-data-model.md
  - spec/5-system/3-error-handling.md
  - spec/5-system/6-websocket-protocol.md
---

> **반영 노트 (consistency-check WARNING 흡수, 2026-07-04)**: (1) `EXECUTION_QUEUE_WAIT_TIMEOUT` 는 `cancelled`+`cancelledBy='timeout'`+`error.code`(기존 미사용 enum 첫 실사용, WS `execution.cancelled` 의 기존 `error?` 재사용) 로 매핑 — 3-error-handling 은 §1.4(failed) 아니라 §1.4~§1.5 사이 cancelled note 배치, `conventions/error-codes.md`(예외 레지스트리)는 정상 명명이라 미등재. (2) settings 편집 governance 명시: workspace=Admin+ `PATCH .../settings`, workflow=Editor+ `PATCH /api/workflows/:id`. (3) admission PENDING-only 근거는 §4.2 jobId dedup 불변식(draft 초안의 "full B3" 인용 정정). (4) `maxConcurrentExecutions` vs Parallel `config.maxConcurrency` 별개 각주. SUMMARY: `review/consistency/2026/07/04/14_13_56/SUMMARY.md`.

# spec-draft — PR2b 동시성 cap + 5분 queue-wait cancel (spec 정의, priority 3-tier 제외)

## 배경·스코프

exec-intake PR2b 의 spec 선행. 사용자 결정(2026-07-04): **spec PR 분리** + **스코프 = cap + 5분 cancel 먼저**(priority 3-tier = triggerType threading 은 독립 후속으로 분리). spec §8 이 정책 기본값(cap 10/3, 5분)은 명시하나 **settings 키 스키마·5분 cancel 에러코드·queued_at 컬럼이 미정의** → 본 draft 로 구현 가능하게 정의한다. 구현은 후속 developer PR.

**이번 스코프**: (1) `settings.maxConcurrentExecutions` 키, (2) admission gate 동작 서술, (3) `queued_at` 컬럼(V104), (4) 5분 queue-wait cancel + `EXECUTION_QUEUE_WAIT_TIMEOUT`.
**제외(후속)**: priority 3-tier(`ExecuteOptions.triggerType` threading — 현 manual>트리거 2-tier 유지), 단일 Execution 최대 노드 수(500) enforcement.

## planner 결정 (규약 선례 기반, 사용자 추가 확인 불요)

1. **settings 키 = `maxConcurrentExecutions`** (spec §8 표 용어 "동시 Execution 수" 와 일치). Workspace 기본 10, Workflow 기본 3. 미설정 시 시스템 기본 fallback. `PATCH .../settings` 부분 머지(기존 timezone/interactionAllowedOrigins 관례 계승). cap level = **둘 다**(워크스페이스 전역 + 워크플로우별, plan 결정) — 둘 다 통과해야 admission.
2. **5분 cancel 에러코드 = `EXECUTION_QUEUE_WAIT_TIMEOUT`** (엔진 레벨). Execution.status = `cancelled` + `error.code`. 기존 `EXECUTION_TIME_LIMIT_EXCEEDED`(failed·active-running 누적)·`WORKER_HEARTBEAT_TIMEOUT`(failed·stalled 소진)와 별개 — 큐 대기 초과는 실행 시작 전이라 시스템 `cancelled`(사용자 취소와 status 공유하되 error.code 로 구분). 기본 한도 = 시스템 env `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`(기본 300000ms).
3. **`queued_at` 컬럼(V104, Timestamp?)** — Execution 이 intake 큐 대기에 진입한 시각(= `execute()` 의 pending INSERT 시각). 5분 판정 = `now - queued_at`. RUNNING 전이 시 `started_at` 별도 set(기존). 재사용 가능 컬럼 없음(started_at 은 recoverStuckExecutions stale 판정과 충돌).

## 변경안

### 4-execution-engine.md §8
- cap 표 "설정 위치" 열을 키 명 구체화: `Workspace.settings.maxConcurrentExecutions`(10) / `Workflow.settings.maxConcurrentExecutions`(3).
- "제한 초과 시 동작" 의 **Planned(PR2b)** 2줄을 구현 정의로:
  - 워크스페이스/워크플로우 cap 초과 → 새 Execution `pending` 큐 대기 → intake consumer(`runExecutionFromQueue`)가 **RUNNING 전이 직전 원자적 admission gate** 로 `COUNT(status='running')` per workspace·workflow 검증; 둘 다 cap 미만이면 RUNNING 진입, 아니면 pending 유지 + delayed 재큐(백오프). **TOCTOU 방지**: 동시 다수 consumer 가 같은 cap 슬롯을 두고 경쟁하므로 원자적 카운트-체크-전이 필요(구현: pg advisory lock 또는 조건부 UPDATE — Rationale).
  - 큐 대기(`now - queued_at`) 5분(env `EXECUTION_QUEUE_WAIT_TIMEOUT_MS`) 초과 → `cancelled` + `error.code='EXECUTION_QUEUE_WAIT_TIMEOUT'`.
- **admission gate 는 첫 세그먼트 시작(PENDING→RUNNING)에만** 적용. stalled 재배달(RUNNING arm, §7.1 PR4)·park 재개(§7.5)는 이미 RUNNING/재진입이라 cap 재심사 skip(§4.2 직렬화 불변식과 정합 — 동일 Execution 동시 active 세그먼트 불가).
- priority 3-tier 는 이번 스코프 아님 명시("manual>트리거 2-tier 유지, 3-tier threading 은 후속").

### 1-data-model.md
- §2.2 Workspace.settings(line 94) 알려진 키에 `maxConcurrentExecutions: number?` (기본 10, §8) 추가.
- §2.4 Workflow.settings(line 120) 알려진 키에 `maxConcurrentExecutions: number?` (기본 3, §8) 명시.
- §2.13 Execution(started_at 인접, line 463)에 `queued_at | Timestamp? | intake 큐 대기 진입 시각(pending INSERT). §8 queue-wait 5분 판정 기준 (now - queued_at). V104` 추가.

### 3-error-handling.md §1.4 + conventions/error-codes.md §3
- 신규 `EXECUTION_QUEUE_WAIT_TIMEOUT` — 엔진 레벨, 큐 대기 5분 초과 → execution `cancelled`. `EXECUTION_TIME_LIMIT_EXCEEDED`(failed)와 구분(대기 초과=cancelled).

## side-effect 점검
- state-machine: `pending → cancelled` 전이가 이미 허용되는지 확인(현 `ALLOWED_TRANSITIONS`). cancelled 에 error.code 동행 관례 확인.
- §9.2 Redis 키: admission 카운트는 DB COUNT(status='running')라 Redis 불요.
- system-status: 큐 depth·cancelled 카운트 표면 영향 확인(무변경 예상).
- exec-intake plan: PR2b 항목을 spec-정의 완료 + 구현 후속으로 갱신.

## Rationale
- **admission gate = consumer-side(runExecutionFromQueue), producer-side 아님**: work-stealing 분산에서 어느 인스턴스가 실행할지는 consume 시점 결정. execute()는 항상 pending enqueue(즉시 반환) 유지 → cap 검증을 consumer 가 RUNNING 전이 직전에 원자 수행해야 분산 정합.
- **cancelled(+error.code) vs failed**: 큐 대기 초과는 노드 실행 자체가 시작 안 됨 → "실패" 보다 "취소"가 의미 정합. 단 시스템 주도이므로 error.code 로 사용자 취소와 구분.
- **priority 3-tier 분리**: triggerType threading 은 `ExecuteOptions`·trigger payload·queue option 3레이어 변경이라 cap gate 와 독립. 별도 PR 로 분리해 각 리뷰 집중(사용자 결정).
