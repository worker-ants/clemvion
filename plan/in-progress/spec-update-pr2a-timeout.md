---
worktree: impl-exec-concurrency-cap
started: 2026-06-04
owner: resolution-applier
---
# Spec Update Draft — PR2a active-running 타임아웃 (§8 · data-flow · EIA)

## 분류

SPEC-DRIFT (코드 개선을 spec 에 반영) — PR2a(d4271ed9) 가 §8 timeout 을 구현했으나 spec 3곳이 아직 구현 전 상태로 남아 있음.

## 원본 발견사항

- SUMMARY#1 (W1): `[SPEC-DRIFT]` spec §8 헤더가 "(미구현 — Planned)" 로 남아 있고, 제한 초과 동작 설명이 "모두 Planned — 미구현"으로 표기. PR2a 가 active-running 타임아웃을 구현했으므로 timeout 부분의 구현 상태 배너를 갱신해야 함.
- SUMMARY#2 (W2): `[SPEC-DRIFT]` §8 표 "설정 위치" 열이 `Workflow.settings`로 되어 있으나 구현은 env 전역 상수(`EXECUTION_MAX_ACTIVE_RUNNING_MS`, 기본 30분). per-workflow 설정은 후속.
- SUMMARY#3 (W3): `[SPEC-DRIFT]` §8 "한도 출처" — 1단계 env 상수 / 2단계 per-workflow 분리가 spec 에 미반영.
- SUMMARY#8 (W8): `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그 및 인라인 텍스트에 `execution-run` 큐 누락. PR1(`impl-exec-intake-queue`)에서 추가됐으나 카탈로그가 미갱신.
- SUMMARY#9 (W9): `spec/5-system/14-external-interaction-api.md §6.4` `execution.failed` 페이로드 예시 `error.code` 목록에 `EXECUTION_TIME_LIMIT_EXCEEDED` 누락.

## 제안 변경

### 1. `spec/5-system/4-execution-engine.md §8`

#### Before (line 936)
```
## 8. 동시 실행 제한 (미구현 — Planned)

> **구현 상태**: 본 절의 동시 실행/노드 수/실행 시간/큐 대기 제한은 **목표 정책(target, §4 intake 큐 의존)** 이며 현재 엔진에 enforcement 코드가 없다. 동시성 cap 은 `execution-run` intake 큐 + 카운트 가드로 enforce 한다. 본 절의 미구현 표면 추적: `plan/in-progress/spec-sync-execution-engine-gaps.md`.
```

```
**제한 초과 시 동작 (모두 Planned — 미구현):**
- 워크스페이스/워크플로우 제한 초과 → 새 Execution은 `pending` 상태로 큐 대기 (intake 큐)
- 누적 active-running 시간 초과 → **`EXECUTION_TIME_LIMIT_EXCEEDED`** 에러 → Execution.status = `failed` ...
- 큐 대기 시간 제한 (기본: 5분) 초과 → `cancelled` 처리
```

```
| 단일 Execution 최대 실행 시간 | 30분 | Workflow.settings | **active-running 누적 시간 기준** (wall-clock 아님, `waiting_for_input` 대기 제외) |
```

#### After (proposed)
```
## 8. 동시 실행 제한

> **구현 상태 (부분 구현)**: 워크스페이스/워크플로우 동시 실행 cap 및 큐 대기 제한은 **목표 정책(Planned)**. 단일 Execution active-running 누적 타임아웃은 **PR2a 구현 완료** (`d4271ed9` — `impl-exec-concurrency-cap`). 미구현 표면 추적: `plan/in-progress/spec-sync-execution-engine-gaps.md`.
```

```
| 단일 Execution 최대 실행 시간 | 30분 | **(1단계)** 시스템 env `EXECUTION_MAX_ACTIVE_RUNNING_MS` (기본 `1800000` ms); `0` = 무제한. **(2단계, 후속)** per-workflow `Workflow.settings` | **active-running 누적 시간 기준** (wall-clock 아님, `waiting_for_input` 대기 제외). 1단계 구현 완료 (PR2a). |
```

```
**제한 초과 시 동작:**
- 워크스페이스/워크플로우 제한 초과 → 새 Execution은 `pending` 상태로 큐 대기 (intake 큐) — **Planned**
- 누적 active-running 시간 초과 → **`EXECUTION_TIME_LIMIT_EXCEEDED`** 에러 → Execution.status = `failed` (엔진 레벨 누적 타임아웃 전용 신규 코드. Code 노드 스크립트 타임아웃 `EXECUTION_TIMEOUT` 과 의미가 달라 코드 분리 — §3-error-handling §1.4) — **PR2a 구현 완료**
- 큐 대기 시간 제한 (기본: 5분) 초과 → `cancelled` 처리 — **Planned**
```

### 2. `spec/data-flow/0-overview.md §4` BullMQ 큐 카탈로그

#### Before (line 93 인라인 텍스트)
```
| Queue | Redis 7 + BullMQ. 현재 등록된 큐: `alerts-evaluator`, `background-execution`, `cafe24-token-refresh`, `makeshop-token-refresh`, `chat-channel-token-rotator`, `document-embedding`, `execution-continuation`, `graph-extraction`, `integration-expiry-scanner`, `login-history-pruner`, `notification-secret-rotator`, `notification-webhook`, `schedule-execution`. |
```

#### After
`execution-run` 을 `execution-continuation` 앞에 삽입:
```
| Queue | Redis 7 + BullMQ. 현재 등록된 큐: `alerts-evaluator`, `background-execution`, `cafe24-token-refresh`, `makeshop-token-refresh`, `chat-channel-token-rotator`, `document-embedding`, `execution-continuation`, `execution-run`, `graph-extraction`, `integration-expiry-scanner`, `login-history-pruner`, `notification-secret-rotator`, `notification-webhook`, `schedule-execution`. |
```

#### Before (§4 표)
(execution-run 큐 행 누락)

#### After (§4 표, 첫 행에 추가)
```
| `execution-run` | `execution-engine.module.ts` | `ExecutionEngineService.execute` (Execution row `pending` 저장 후 발행) | `ExecutionRunProcessor` (work-stealing, `ExecutionEngineService.runExecutionFromQueue`) | Execution 첫 active 세그먼트 (시작→첫 BLOCK/완료) — [실행 엔진 §4](../5-system/4-execution-engine.md#4-실행-큐intake) |
```

### 3. `spec/5-system/14-external-interaction-api.md §6.4`

#### Before (line 532)
```json
"code":    "EXECUTION_TIMEOUT" | "MAX_ITERATIONS_EXCEEDED" | "CYCLE_DETECTED" | ... ,
```

#### After
```json
"code":    "EXECUTION_TIMEOUT" | "EXECUTION_TIME_LIMIT_EXCEEDED" | "MAX_ITERATIONS_EXCEEDED" | "CYCLE_DETECTED" | ... ,
```

## 적용 우선순위

1. (즉시) §4 BullMQ 카탈로그 — `execution-run` 행 추가: PR1 누락 단순 보완.
2. (즉시) EIA §6.4 error.code 예시 갱신: 한 줄 추가.
3. (즉시) execution-engine.md §8 구현 상태 배너 + 표 "설정 위치" 컬럼 갱신: 사용자·개발자 오해 방지.

## 관련 파일

- `spec/5-system/4-execution-engine.md` §8 (lines ~936–953)
- `spec/data-flow/0-overview.md` §4 (lines ~93, ~166–181)
- `spec/5-system/14-external-interaction-api.md` §6.4 (line ~532)
