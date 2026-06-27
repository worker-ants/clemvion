---
worktree: eia-seq-nfr-spec-2845e7
started: 2026-06-27
owner: project-planner
spec_impact: spec/5-system/14-external-interaction-api.md
---

# spec-draft: EIA 분산 seq counter NFR 명문화 (EIA-NF-06 / EIA-NF-07)

> 대상 spec: [`spec/5-system/14-external-interaction-api.md`](../../spec/5-system/14-external-interaction-api.md) §3.5 비기능 요구사항
> 출처: [`plan/complete/eia-distributed-seq-load-verify.md`](../complete/eia-distributed-seq-load-verify.md) 수용 기준 + 실 e2e 검증 (PR #730, main 병합 완료)

## 배경

`ExecutionSeqAllocator` (Redis `INCR exec:seq:<id>`, §R7) 의 분산 monotonic 보장은
이미 구현·검증 완료다. 그러나 그 **정량 기준**(부하 하 단조 유일성, 발급 latency 회귀
예산)은 plan 수용 기준 + 테스트 코드에만 존재하고 spec 본문(§3.5 비기능 요구사항)에는
명문화돼 있지 않았다. PR #730 의 실-Redis e2e 가 이 기준들을 경험적으로 입증
(≈63k events/s, single-instance latency median 0.083ms)했으므로, 정식 NFR 로 승격한다.

이는 [SPEC-DRIFT] 후속 — "구현/검증이 spec 보다 앞서 있어 spec 이 낡음"의 정식 역류 경로.

## 변경안 — §3.5 표에 2행 추가

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EIA-NF-06 | **분산 seq monotonic — 부하 하 유지 (Redis 가용 경로)**: Redis 가용(정상) 경로에서, 멀티 인스턴스 환경의 같은 execution emit 이 서로 다른 인스턴스에서 동시 발생해도 seq(§R7 의 execution-scoped monotonic counter)는 1000 events/s 부하에서 중복·역전 없이 단조 유일하다 — Redis `INCR exec:seq:<id>` 의 원자성으로 보장 (§R7 · [실행 엔진 §9.2](./4-execution-engine.md#92-용도별-키-정의-및-ttl)). **degraded 예외**: Redis 미가용 시 in-memory per-instance fallback 으로 cross-instance monotonic 은 미보장 — 수용된 trade-off ([WS §2.2](./6-websocket-protocol.md#22-서버--클라이언트-이벤트-래퍼) · 실행 엔진 §9.2). | 필수 |
| EIA-NF-07 | **seq 발급 latency 회귀 예산**: 분산 seq counter(Redis `INCR`) 도입에 따른 emit 당 seq 발급(`ExecutionSeqAllocator.next()`)의 추가 latency 는 single-instance 환경에서 in-memory baseline 대비 median < 5ms. | 필수 |

## Rationale 보강 (§R7 말미에 1문장 추가)

§R7 의 atomic INCR counter 전제에 정량 NFR 연결을 명시:
> 이 counter 의 (Redis 가용 경로) 부하 하 단조 유일성과 발급 latency 예산은 §3.5
> EIA-NF-06 / EIA-NF-07 로 정량화되어 있으며, 실-Redis 2-instance e2e 로 경험 검증되었다
> (관측: ≈63k events/s, single-instance latency median 0.083ms — 기준 대비 큰 여유).
> degraded(Redis 미가용) 구간의 cross-instance monotonic 미보장은 WS §2.2 / 실행 엔진 §9.2
> 의 수용된 trade-off 와 동일하다.

## 결정 근거 (이 draft 의 Rationale)

- **EIA-NF-06 을 "처리량 SLO" 가 아니라 "부하 하 correctness 불변식"으로 표현한 이유**:
  실제 보장 대상은 "1000/s 를 처리한다"가 아니라 "1000/s 부하에서도 monotonic 유일성이
  깨지지 않는다"이다. 관측 처리량(≈63k/s)은 기준의 capacity 여유를 보여주는 부수 지표일
  뿐, 요구사항의 본질은 정확성이다. EIA-NF-05(동시성 1건)와 같은 "불변식형 NF" 계열.
- **degraded 단서를 NF-06 에 명시한 이유 (W1)**: Redis-only 저장소 정책상 Redis 미가용 시
  in-memory per-instance fallback 으로 degrade 하며 그 구간의 cross-instance monotonic 은
  미보장이 **이미 수용된 trade-off** 다 (WS §2.2 · 실행 엔진 §9.2). NF-06 을 무조건 보장으로
  쓰면 그 SoT 와 모순되므로 "Redis 가용 경로 한정 + degraded 예외 참조" 로 표현해 판정
  기준이 영역마다 갈리지 않게 한다.
- **EIA-NF-07 을 절대 latency 가 아니라 회귀 예산(< 5ms vs in-memory baseline)으로 둔 이유**:
  in-memory v1 대비 Redis round-trip 이 더하는 비용을 제한하는 것이 본 강화의 수용 조건이었다
  (plan/complete/eia-distributed-seq-counter.md 수용 기준 #3). baseline 이 사실상 0 이라
  절대 per-call latency ≈ 회귀량이며, EIA-NF-01/02(절대 latency SLO)와 성격이 구분된다.
- **우선순위 필수**: 두 항목 모두 이미 구현·검증된 계약을 문서화하는 것이라 "필수" 로 둔다
  (신규 목표 상향이 아님).
- **코드/테스트 변경 없음**: 본 draft 는 spec 문서화만. 구현·e2e 는 PR #730 에서 완료됨.

## 적용 결과 (2026-06-27)

- spec 반영 완료: §3.5 에 EIA-NF-06/07 추가, §R7 구현 전제에 Redis-only 확정·NFR 연결·degraded trade-off 명시.
- `/consistency-check --spec` 2 라운드: 1차 W1(degraded 단서)/W2(§5.6 오참조) → 정정, 2차 **BLOCK: NO** (Critical 0, 5/5 checker). 산출 `review/consistency/2026/06/27/21_45_23/`.
- INFO 처리: §R7 DB-fallback 기각 1문장, NF-07 multi-instance 단서, `merge-p2-async-fanin.md` 강화-완료 노트.
- 코드/테스트 변경 없음 — 구현·e2e 는 PR #730 에서 완료됨.
