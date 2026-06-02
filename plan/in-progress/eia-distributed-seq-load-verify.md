---
worktree: (미정 — 착수 시 신규)
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

- [ ] `docker-compose.e2e.yml` 에 2번째 backend 서비스(`backend-e2e-2`) 추가 — 동일 `redis` 공유
- [ ] 같은 executionId 의 emit 을 두 인스턴스에서 동시 유발하는 시나리오 하니스
      (예: 두 인스턴스의 `ExecutionSeqAllocator.next()` 를 같은 키로 동시 호출, 또는
       continuation 을 양 인스턴스에 분배) → seq 중복·역전 0 assert
- [ ] 부하: 1000 events/s 시 seq 단조 증가 보장 측정
- [ ] single-instance latency 회귀 < 5ms 마이크로벤치 (수용 기준 #3 경험적 확인)

## 비고

- 미착수해도 핵심 강화의 정확성에는 영향 없음 (Redis INCR 원자성 + unit 계약).
- 착수 시 신규 worktree 에서 진행하고 본 plan 의 worktree frontmatter 갱신.
