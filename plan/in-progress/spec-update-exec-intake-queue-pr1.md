---
worktree: impl-exec-intake-queue
started: 2026-06-04
owner: resolution-applier
---
# Spec Update Draft — exec-intake-queue PR1 (§4 배너·§9.3·§11)

## 분류

SPEC-DRIFT (코드 개선을 spec 에 반영) — PR1 이 §4.1–4.3 intake 큐를 구현 완료했으나
spec 본문이 여전히 "Planned/미구현/target" 으로 표기됨. 코드가 옳고 spec 이 따라와야 한다.
코드 revert 금지.

---

## 원본 발견사항

**SUMMARY#3**: spec §9.3 BullMQ 큐 목록 표에 `execution-run` 행이 "(target — §4)" 와
"구현 시 결정" 으로 기술. 코드는 `attempts:1`, `removeOnComplete:true`, `removeOnFail:false`,
`maxStalledCount:0` 으로 구현 완료. jobId = executionId (seq 없음, PR1 은 1:1 enqueue).

**SUMMARY#4**: spec §11 ENV 표에 `EXECUTION_RUN_WORKER_CONCURRENCY` 행이 "기본값:
(구현 시 결정)" 으로 등재됨. 코드(execution-run.queue.ts + .env.example)는 기본값 `1`,
비양수·비정수·비숫자 fallback 을 구현 완료.

**SUMMARY#5**: spec §4 배너가 "§4.1~4.3 은 미구현 (Planned)" 이고 §4.1–4.3 본문이
in-process fire-and-forget 현 구현을 기술. PR1 이 `execution-run` 큐 + `ExecutionRunProcessor`
work-stealing 을 구현 완료하여 해당 배너가 stale. §7.1·§8 은 PR2-4 Planned 유지.

---

## 제안 변경

### §4 배너 (line 348) — SUMMARY#5

**Before:**
```
> **구현 상태 — §4.1~4.3 은 미구현 (Planned)**: 아래 §4.1~4.3 의 `execution-run`
> intake 큐·work-stealing·우선순위는 **목표 아키텍처(target)** 이며 현재 코드에는 없다.
> 현 구현은 `execute()` 가 `runExecution` 을 **in-process fire-and-forget** 으로
> 호출하고(요청받은 인스턴스에 pinned), 노드는 `runExecution` 의 **in-process while-loop
> 으로 직접 dispatch** 한다 (§2.1 / §9.3). 별도 BullMQ 큐는 `background-execution`(§3.3)
> 과 `execution-continuation`(§7.4) 둘뿐이다. §4.4 이벤트 발행 sink 정책만 현 구현과
> 일치한다. 본 절의 미구현 표면 추적: `plan/in-progress/execution-engine-residual-gaps.md`
> 및 `plan/in-progress/spec-sync-execution-engine-gaps.md`.
```

**After:**
```
> **구현 상태 — §4.1~4.3 PR1 구현 완료**: `execution-run` intake 큐·work-stealing·
> 우선순위(§4.1–4.3)는 PR1(`impl-exec-intake-queue`)에서 구현됨. `execute()` 는
> Execution row 를 `pending` 으로 저장한 뒤 `execution-run` 큐에 job 을 발행하고
> 즉시 반환한다. `ExecutionRunProcessor` 가 work-stealing 으로 pick up 해 첫 active
> 세그먼트를 처리한다. 세그먼트 내부 노드 dispatch 는 여전히 in-process (`runExecution`
> while-loop — §2.1). **§7.1 stalled-job 재배달(crash 재개)·§8 동시성 cap 은 Planned
> (PR2-4)** — 현재 `maxStalledCount:0` 으로 stalled 재배달 차단, enforcement 코드 없음.
```

### §9.3 BullMQ 큐 목록 표 `execution-run` 행 (line 998) — SUMMARY#3

**Before:**
```markdown
| `execution-run` | (target — §4) execution intake — 첫 active 세그먼트(실행 시작→첫 BLOCK/완료)
  work-stealing 분산 | 구현 시 결정 (stalled 재배달 포함) | 신규. `execute()` 의
  fire-and-forget in-process 호출 대체. jobId `<executionId>:run:<seq>`, BullMQ job
  priority 로 `manual`>`webhook`>`schedule` |
```

**After:**
```markdown
| `execution-run` | execution intake — 첫 active 세그먼트(실행 시작→첫 BLOCK/완료)
  work-stealing 분산 (PR1 구현 완료) | `attempts:1`, `maxStalledCount:0` (stalled
  재배달 차단 — PR4 에서 멱등 rehydration 과 함께 상향) | PR1 구현. `execute()` 의
  fire-and-forget in-process 호출 대체. `removeOnComplete:true`, `removeOnFail:false`.
  jobId = executionId (PR1 은 1:1 enqueue, re-enqueue 없음 — PR3/PR4 에서 seq 추가
  예정). BullMQ job priority 로 `manual`>`webhook`>`schedule` (`triggerType` → priority
  매핑, `ExecutionRunTriggerType`) |
```

### §11 ENV 표 `EXECUTION_RUN_WORKER_CONCURRENCY` 행 (line 1098) — SUMMARY#4

**Before:**
```markdown
| `EXECUTION_RUN_WORKER_CONCURRENCY` | (구현 시 결정) | (target — §4) `execution-run`
  intake worker 가 인스턴스당 병렬 처리하는 active 세그먼트 수 — work-stealing 처리량·
  backpressure·§8 동시성 cap 의 토대. 비양수·비정수·비숫자 입력 fallback 은
  `CONTINUATION_WORKER_CONCURRENCY` 패턴 준용 |
```

**After:**
```markdown
| `EXECUTION_RUN_WORKER_CONCURRENCY` | `1` | `execution-run` intake worker 가
  인스턴스당 병렬 처리하는 active 세그먼트 수 (PR1 구현 완료). work-stealing 처리량·
  backpressure·§8 동시성 cap(PR2)의 토대. 기본 1(직렬). 비양수·비정수·비숫자·공백
  전용 입력은 1 로 fallback(`resolveExecutionRunWorkerConcurrency`, `CONTINUATION_WORKER_CONCURRENCY`
  패턴 준용). 모듈 로드 시 1회 읽음 — 변경은 인스턴스 재시작 시 반영 |
```

---

## 범위 외 — PR2-4 Planned 유지

다음 항목은 이 draft 에서 **변경하지 않는다** (spec Planned 상태 유지):

- §7.1 stalled-job 재배달·heartbeat 기반 검출 (PR3/PR4)
- §8 동시성 cap (`maxStalledCount`, active count 집계) (PR2)
- §9.3 `exec:run:seq:<executionId>` Redis key "(target — §4)" 표기 (PR3 seq 추가 시 갱신)
- §9.1 Redis 키 패턴 관련 언급 (영향 없음)

---

## 적용 절차

1. `project-planner` 가 본 draft 를 검토·승인
2. `/consistency-check --spec spec/5-system/4-execution-engine.md` 실행 → BLOCK:NO 확인
3. spec 본문 Edit (§4 배너, §9.3 표, §11 표 3곳)
4. spec 갱신 commit 후 `resolution-applier` 재호출 (동일 session_dir)
   — `_resolution_state.json` idempotency 로 코드 항목 skip, spec draft 마무리만
