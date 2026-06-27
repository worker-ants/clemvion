---
worktree: eia-seq-load-verify-6f5ebc
started: 2026-06-02
owner: developer
priority: optional
parent: plan/complete/eia-distributed-seq-counter.md
---

# (선택) EIA 분산 seq counter — 2-instance 실 부하 race repro

> 상위(완료): [`plan/complete/eia-distributed-seq-counter.md`](../complete/eia-distributed-seq-counter.md)
> 본 plan 은 그 핵심 강화의 **선택적 경험적 검증** 분리분이다. 핵심 구현·정합성은 이미 완료.

## 배경

`eia-distributed-seq-counter.md` 의 핵심 강화(`ExecutionSeqAllocator` — Redis `INCR exec:seq:<id>`,
emit async 전환)는 2026-06-02 완료되어 lint/unit/build/e2e(140) + `/ai-review`(Critical 0) 통과했다.

분산 monotonic 보장은 **Redis INCR 의 원자성**(서로 다른 인스턴스의 동시 INCR 도 단조 유일)으로
설계상 제공되며, unit 의 "100개 동시 `next()` → 1..100 유일" regression 으로 계약이 고정돼 있다.

본 plan 은 그 위에 **경험적(empirical) 부하 repro** 를 더하는 선택 항목이다 — 필수 아님.

## 작업 단위 (선택)

### 채택한 검증 방식 (2026-06-27 사용자 결정)

원안의 "2-container docker harness" 대신 **real-Redis integration test** 로 검증한다.
근거: Redis 입장에서 **별도 ioredis 연결 = 별도 프로세스**이므로, 한 테스트 프로세스에서
독립 연결을 가진 두 `ExecutionSeqAllocator` 인스턴스를 같은 executionId 로 동시 호출하면
INCR 원자성에 의존하는 분산 race 를 **충실히** 재현한다. docker backend-e2e-2 컨테이너 +
HTTP 구동 하니스(느리고 비결정적)보다 결정적·CI 친화적이며 검증 대상(INCR 원자성)은 동일.
따라서 `backend-e2e-2` 컨테이너 추가는 **불요로 판단해 생략**한다.

산출물: `codebase/backend/test/execution-seq-allocator-load.e2e-spec.ts` (e2e 티어 — 실 `redis` 컨테이너 사용).

- [x] ~~`docker-compose.e2e.yml` backend-e2e-2 추가~~ → 생략 (위 근거). 실 `redis` 는 기존 e2e 인프라 재사용. runner 에 `REDIS_HOST`/`REDIS_PORT` 명시만 추가.
- [x] 두 인스턴스 동시 `next()` 같은 키 → seq 중복·역전 0 assert (union = 1..N 유일)
- [x] 부하: 1000 events/s 시 seq 단조 증가 보장 측정 (throughput 측정 + 단조 유일 assert)
- [x] single-instance latency < 5ms 마이크로벤치 (수용 기준 #3 경험적 확인)

## 검증 결과 (TEST WORKFLOW)

- [x] lint (PASS 65s)
- [x] unit (PASS 48 suites)
- [x] build (PASS, docker 이미지 포함 131s)
- [x] e2e (PASS 218 tests — 본 load spec 3개 포함)
- [x] /ai-review (LOW, Critical 0 → fix 후 최종 round Warning 0 clean)

### 측정값 (실 Redis e2e, 최종 round)

- cross-instance 동시 1000 발급 (인스턴스당 500): 중복·역전 0, union = 1..1000 ✓
- throughput: 1000 발급 / 15.9ms ≈ **62,928 events/s** (목표 1000/s 대비 ~63× 여유)
- single-instance next() latency: median **0.083ms**, avg 0.094ms, p95 0.185ms (수용 기준 < 5ms 충족)

### /ai-review 트레일

1. `review/code/2026/06/27/20_40_18/` — Warning 1(allocB.release) → fix + RESOLUTION
2. `review/code/2026/06/27/20_54_30/` — Warning 2(스프레드 스택·docker secret) → 전자 fix, 후자 decline(pre-existing) + RESOLUTION
3. `review/code/2026/06/27/21_07_51/` — **Warning 0 clean** 수렴

## 비고

- 미착수해도 핵심 강화의 정확성에는 영향 없음 (Redis INCR 원자성 + unit 계약).
- 착수 시 신규 worktree 에서 진행하고 본 plan 의 worktree frontmatter 갱신.
