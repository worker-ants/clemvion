---
worktree: impl-exec-concurrency-cap
started: 2026-06-04
owner: resolution-applier
---
# Spec Update Draft — PR2a active-running invariants

## 분류

SPEC-DRIFT (코드 개선을 spec 에 반영) — 구현이 spec 을 의도적으로 보완·확장했으며 코드가 옳다. spec Rationale/본문이 낡은 상태.

## 원본 발견사항

**SUMMARY#1 (CONCURRENCY W1)** — Graceful Shutdown 시 `segmentStartMs` in-memory Map flush 미보장 → under-count 허용은 의도적 trade-off(코드 JSDoc W4 존재)이나 spec Rationale 에 미반영.

**SUMMARY#2 (CONCURRENCY W2)** — `assertActiveTimeWithinLimit` + `updateExecutionStatus` read-check-then-act 비원자성이 BullMQ 직렬화 불변식으로 보호됨(코드 JSDoc W5)이나 spec §4.2/Rationale 에 미반영.

**INFO #1 (SPEC-DRIFT)** — `spec/5-system/4-execution-engine.md §8, §11` 의 "초과 시(`>`)" 표현과 구현의 `>=`(이상) 판정 불일치. 코드가 보수적으로 옳고 spec Rationale에 근거 미반영.

**INFO #2 (SPEC-DRIFT)** — Graceful Shutdown under-count 허용 결정이 코드 주석(W4)에만 존재, spec Rationale 미반영.

**INFO #3 (SPEC-DRIFT)** — `segmentStartMs` 직렬화 불변식이 코드 주석(W5)에만 존재, spec §4.2 또는 Rationale 미반영.

## 제안 변경

### 1. §8 / §11 "초과 시" 표현 → `>=` 보수적 판정 명시 (INFO #1)

**위치**: `spec/5-system/4-execution-engine.md §8` 테이블 비고 열 및 §11 env 표 `EXECUTION_MAX_ACTIVE_RUNNING_MS` 행

**Before** (§8 제한 초과 시 동작):
```
누적 active-running 시간 초과 → EXECUTION_TIME_LIMIT_EXCEEDED
```

**After**:
```
누적 active-running 시간이 한도 이상(`activeNow >= maxActiveRunningMs`) →
EXECUTION_TIME_LIMIT_EXCEEDED …
```
(§11 env 표 `초과 시` 문구도 동일하게 `한도 이상 시(>=)` 로 수정)

**Rationale 에 추가** (`### 타임아웃을 active-running 누적 기준으로` 항 또는 신설 항):

> **판정 기준 — `>=` (보수적 선택)**: 코드는 `activeNow >= maxActiveRunningMs` 로 경계값 자체도 "한도 초과"로 간주한다. 정확히 한도에 도달한 세그먼트는 의미상 한도를 소진했으므로 종결이 타당하다. strict `>` 보다 `>=` 가 silent under-enforcement 위험이 없어 보수적으로 더 안전하다.

---

### 2. Graceful Shutdown under-count 허용 결정 spec 반영 (SUMMARY#1 W1 / INFO #2)

**위치**: `spec/5-system/4-execution-engine.md ## Rationale` — `### Durable Continuation & Graceful Shutdown` 항에 다음 단락 추가.

**추가 내용**:

> **Graceful Shutdown 시 active-running 시간 under-count 허용 (PR2a 결정)**:
>
> SIGTERM 수신 시 in-memory `segmentStartMs` Map 에 기록된 진행 중 세그먼트의 경과분은 DB(`Execution.activeRunningMs`)에 flush 되지 않은 채로 소실될 수 있다. 해당 세그먼트가 BullMQ stalled-job 메커니즘(§7.1)에 의해 다른 워커에 재배달되면, 재배달 워커는 `segmentStartMs` 가 없으므로 그 세그먼트의 경과분을 누적하지 못해 **active 시간을 under-count** 한다.
>
> 이 under-count 는 의도적으로 허용하는 trade-off 다:
> - Graceful Shutdown 은 인프라 이벤트로 빈도가 낮고 단일 세그먼트 지속시간(초~분 단위)이 총 한도(30분)에 비해 작아 실질 bypass 효과는 미미하다.
> - flush 훅(`OnModuleDestroy` + `segmentStartMs` partial accumulate + DB save) 을 추가하면 SIGTERM 경로 복잡도가 높아지고 재배달 워커와의 경합(DB save vs. 재배달 워커의 segmentStart 재기록) 이 생긴다.
> - 경합 없는 flush 설계는 PR3(세그먼트 영속화 + crash 복구)에서 `segmentStartMs` 를 Redis 또는 DB 에 영속할 때 자연스럽게 해소된다.
>
> PR3 에서 flush 정책을 명시적으로 확정한다.

---

### 3. BullMQ 직렬화 불변식 spec 반영 (SUMMARY#2 W2 / INFO #3)

**위치**: `spec/5-system/4-execution-engine.md §4.2` (또는 §4 설명 내 적절한 위치) 및 `## Rationale`

**§4.2 (또는 §4 설명) 에 추가**:

> **active-running 직렬화 불변식**: `assertActiveTimeWithinLimit`(타임아웃 판정)과 `updateExecutionStatus`(상태 전이 + activeRunningMs 누적) 사이에 read-check-then-act 비원자성이 있다. 이는 **BullMQ 큐 직렬화**로 보호된다 — 동일 Execution 에 대한 `execution-run`/`execution-continuation` job 은 항상 1개이며(jobId = executionId dedup), 동일 워커 인스턴스에서 동일 Execution 의 두 active 세그먼트가 동시 실행되지 않는다. 따라서 `assertActiveTimeWithinLimit`와 `updateExecutionStatus` 사이에 다른 세그먼트가 끼어드는 경로가 구조적으로 없다.
>
> **PR2b 이후 재검증 조건**: 재진입 경로(예: `retry_last_turn` + 동시 active 세그먼트 가능 경로)가 추가되면 이 불변식이 깨질 수 있다. PR2b 설계 착수 전 재진입 경로를 불변식 관점에서 재검증해야 한다.

**Rationale 에 추가** (`### 타임아웃을 active-running 누적 기준으로` 항 또는 신설 항):

> **타임아웃 판정 비원자성 — BullMQ 직렬화 불변식으로 보호**: `assertActiveTimeWithinLimit`는 DB 누적값 + in-progress 경과분을 읽어 한도 판정하고, `updateExecutionStatus`는 세그먼트 종료 시 DB 에 누적값을 기록한다. 두 연산 사이에는 잠금이 없다. 그러나 BullMQ `jobId = executionId` dedup 불변식(§4.2)에 의해 동일 Execution 의 active 세그먼트는 항상 1개이고 concurrently 실행되지 않으므로, 이 비원자성은 현행 아키텍처에서 실질 race 를 일으키지 않는다. PR2b+ 재진입 경로 추가 시 재검증 필요.

## 메타

- 원 spec 파일: `spec/5-system/4-execution-engine.md`
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` (PR2b/PR3 flush 정책 후속)
- 관련 코드 주석: `execution-engine.service.ts` JSDoc W4(under-count), W5(직렬화 불변식)
- 적용 전 `/consistency-check --spec` 실행 필요 (project-planner 책임)
