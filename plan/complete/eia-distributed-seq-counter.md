---
worktree: eia-distributed-seq-<slug>
started: 2026-05-21
owner: developer
---

# EIA — 분산 환경 seq counter 강화 (Redis INCR / DB row-level lock)

> 작성일: 2026-05-21
> 상위: `plan/complete/external-interaction-api.md` §"완료 후 잔여"
> 관련 spec: [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §R7 보강 노트

## 배경

PR2 (#230) 의 P0 가 `WebsocketService.emitExecutionEvent` 의 execution-scoped monotonic seq
counter 를 v1 으로 **in-memory `Map<executionId, number>`** 구현. single-instance 환경 가정.

분산 환경 (multi-instance backend) 에서 같은 execution 의 emit 이 두 instance 에서 동시에
발생하면 seq 가 중복·역전되어 외부 SSE / Notification 의 monotonic invariant (Spec R7) 가
깨질 수 있다. spec R7 보강 노트에 "분산 race 발견 시 Redis INCR 또는 DB row-level lock 으로 강화"
follow-up 명시.

본 plan 은 그 강화의 실 구현.

## 사용자 결정 사항 (선결 필요)

1. **운영 환경**: single-instance 만 운영 / multi-instance 운영 / 향후 multi-instance 계획
   → multi-instance 가 아니면 본 plan 자체가 불필요 (v1 in-memory 로 충분).
2. **저장소**: (a) Redis `INCR exec:seq:<id>` — BullMQ 와 동일 Redis 재사용, 빠름, 다만 Redis
   down 시 fallback 정책 필요 / (b) DB `Execution.seq_counter` 컬럼 + `UPDATE ... RETURNING`
   row-level lock — 트랜잭션 commit-after-emit 규약과 자연 정합, 다만 DB 부담 증가 / (c) Hybrid
   — Redis INCR 우선, Redis 미가용 시 DB fallback.
3. **emit signature 변경 영향**: 현재 `emitExecutionEvent` 는 sync. seq 발급이 async 가 되면
   호출자 100+ 곳 (각 노드 핸들러 / execution-engine / continuation-bus 등) 전체 await 마이그레이션
   영향. 또는 pre-allocate batch (예: 10개씩 INCRBY) 로 sync 유지하되 batch 소진 시만 async.

## 영향 분석

### sync → async 전환 시
- ExecutionEngine 의 `runExecution` loop / handler dispatch 안 emit 호출이 모두 await.
- `processExecutionEvents` 같은 stream consumer 가 영향.
- 단위 테스트의 mock 신호도 async resolution.

### Redis INCR 단순 적용 시
- emit 시 `await redis.incr('exec:seq:<id>')` 1회 — 약 1-3ms 추가 latency.
- Redis pipeline 으로 batch 가능하지만 단일 emit 의 sequencing 보장이 우선.

### DB row-level lock 시
- ExecutionEngine 이 이미 트랜잭션 안에서 작동 — 같은 트랜잭션에서 `Execution.seq_counter` UPDATE
  + RETURNING 으로 atomic 발급.
- 트랜잭션 commit 전에 seq 가 외부에 새지 않도록 emit 시점이 commit 후로 강제 (EIA-RL-04 와 정합).

> **진행 상태 (2026-06-02)**: 실행 체크리스트 = [`eia-distributed-seq-checklist.md`](./eia-distributed-seq-checklist.md).
> 사용자 결정: multi-instance 운영 + **Redis-only** (하이브리드에서 수정). emit **async 전환** (batch 기각).

## 작업 단위

### 1. PoC — race 발견 가능 여부 검증

- [x] ~~다중 instance race 재현~~ — 사용자가 **multi-instance 운영 확정**으로 "강화 필요 여부 판정" 갈음(강화 진행). 2-instance 실 repro 는 §3 부하 항목(선택적)으로 이관
- [x] in-memory v1 의 분산 gap 은 spec §R7 / 본 plan 배경에서 인지 — Redis INCR 로 해소

### 2. 구현 (Redis-only)

- [x] 저장소 (c)→**Redis-only** 확정 (DB fallback 미사용, Redis 장애 시 in-memory degraded)
- [x] emit signature **async 전환** (batch 는 인스턴스 migration 시 monotonic 역전 재유발로 기각)
- [x] `ExecutionSeqAllocator`(Redis `INCR` + pipeline TTL) + WebsocketService/facade async + 호출처 37곳 await + 단위 테스트
- [x] 분산 race regression 테스트 (100 동시 next() 유일성)

### 3. 검증

- [x] backend lint + unit(5406) + build + e2e(140)
- [x] 부하 repro 는 **선택적 follow-up 으로 분리** → [`eia-distributed-seq-load-verify.md`](../in-progress/eia-distributed-seq-load-verify.md). 핵심 보장은 Redis INCR 원자성 + unit(100 동시 유일성)으로 충족 (본 plan 범위 완료)

## 수용 기준

- 분산 환경에서 같은 execution 의 모든 emit 이 단일 monotonic 순서
- SSE `id:` / Notification `seq` / WebSocket envelope `seq` 가 항상 같은 값
- single-instance 환경에서 latency 회귀 < 5ms (current in-memory baseline 대비)

## 의존성

- 본 plan 진행 시 `plan/in-progress/merge-p2-async-fanin.md` §1 PoC 의 "EIA seq monotonic 보장
  검증" 항목과 통합 — 같은 worktree 안에서 PoC.
