# Rationale 연속성 검토 결과

검토 대상: `plan/in-progress/spec-draft-eia-seq-nfr.md`
검토 모드: spec draft (--spec)
검토일: 2026-06-27

---

## 발견사항

### 발견사항 1
- **[INFO]** R7 "Redis INCR 또는 DB row-level lock" 문구와 실제 확정 결정의 불일치 — target 은 정확히 Redis-only 를 가리키나, R7 원문은 여전히 두 대안을 병기
  - target 위치: `plan/in-progress/spec-draft-eia-seq-nfr.md` — EIA-NF-06 본문, "§R7 · [실행 엔진 §9.2]" 참조
  - 과거 결정 출처: `spec/5-system/14-external-interaction-api.md` § Rationale R7 ("Redis `INCR exec:seq:<id>` 또는 DB row-level lock") vs. `plan/complete/eia-distributed-seq-counter.md` 수용 기준 및 결정 목록 ("저장소 (c)→Redis-only 확정 — DB fallback 미사용")
  - 상세: R7 원문은 "Redis INCR 또는 DB row-level lock" 이라고 두 구현 방법을 열거하고 있다. 그러나 실제 결정은 `eia-distributed-seq-counter.md` 에서 "DB fallback 미사용, Redis 장애 시 in-memory degraded" 로 Redis-only 가 확정됐으며, `spec/5-system/4-execution-engine.md §9.2` 와 `spec/5-system/6-websocket-protocol.md §2.2` 도 `exec:seq:<id>` 를 Redis-only + in-memory degraded fallback 로 명시한다. target draft 의 EIA-NF-06 은 "Redis `INCR exec:seq:<id>` 의 원자성으로 보장" 이라고 Redis-only 를 정확하게 가리키지만, R7 원문이 여전히 "또는 DB row-level lock" 을 포함해 R7 Rationale 자체가 낡아 있다. target draft 는 이 간극을 노출시키나 스스로 해결하지 않는다.
  - 제안: target draft 에서 R7 Rationale 말미에 다음을 추가하거나, target 가 §R7 Rationale 갱신을 별도 항목으로 명기할 것. "DB row-level lock 대안은 `plan/complete/eia-distributed-seq-counter.md` 결정 (c) Redis-only 확정에 의해 폐기됐다." 이는 target 의 범위(spec §3.5 표 + §R7 말미 1문장)에 포함될 수 있다.

### 발견사항 2
- **[INFO]** EIA-NF-07 의 단위 환경 한정("single-instance") 과 기존 원칙(분산 환경 정상 경로) 과의 범위 차이
  - target 위치: `plan/in-progress/spec-draft-eia-seq-nfr.md` — EIA-NF-07 본문 "single-instance 환경에서 in-memory baseline 대비 median < 5ms"
  - 과거 결정 출처: `plan/complete/eia-distributed-seq-load-verify.md` 수용 기준 #3 ("single-instance latency < 5ms"), `plan/complete/eia-distributed-seq-counter.md` 수용 기준 ("single-instance 환경에서 latency 회귀 < 5ms (current in-memory baseline 대비)")
  - 상세: target 의 EIA-NF-07 표현은 plan 수용 기준 #3 을 정확히 반영한다. single-instance 한정 + in-memory baseline 대비 회귀 예산이라는 구조도 동일하다. 기각된 대안의 재도입이나 원칙 위반은 아니다. 단, 향후 multi-instance 환경에서의 latency 요건은 미정의인 채로 남고, NF-07 문언 상 multi-instance per-hop latency 가 이 NFR 에 적용되는지 모호할 수 있다. target 의 결정 근거("EIA-NF-01/02 와 성격 구분")는 이를 의도적으로 범위 밖으로 둔 것이 명확하다.
  - 제안: 현 상태 수용 가능. 단, NF-07 비고 또는 draft 결정 근거에 "multi-instance 간 network hop latency 는 EIA-NF-01/02 에서 별도 관리" 임을 1문장 보강하면 향후 해석 다툼을 예방한다.

### 발견사항 3
- **[INFO]** `exec:cont:seq` (continuation seq) 의 fail-fast 결정과 `exec:seq` (emit-event seq) 의 in-memory degraded fallback 비대칭 — target 이 이를 혼동 없이 다루는지 확인
  - target 위치: `plan/in-progress/spec-draft-eia-seq-nfr.md` — EIA-NF-06 본문, "degraded 예외: Redis 미가용 시 in-memory per-instance fallback"
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md §9.2` ("continuation seq 는 jobId dedup 계약 보존이 우선이라 의도적으로 비대칭 — `exec:seq` 는 in-memory degraded fallback 허용, `exec:cont:seq` 는 fail-fast"), `plan/complete/eia-distributed-seq-counter.md` M-7 항목
  - 상세: target 의 EIA-NF-06 은 `exec:seq` (emit-event seq) 의 in-memory degraded fallback 만을 설명한다. `exec:cont:seq` (continuation seq) 가 fail-fast 임은 EIA spec 범위 밖이라 혼동 위험이 낮다. target 이 두 카운터를 분리해 언급하지 않는 것은 scope 에 맞고, 기각된 대안의 재도입에 해당하지 않는다. Rationale 연속성 관점에서 문제 없음.
  - 제안: 제안 없음. 현 draft 범위에서 적절히 분리되어 있다.

---

## 요약

target draft (`spec-draft-eia-seq-nfr.md`) 가 도입하는 EIA-NF-06·EIA-NF-07 은 기존 Rationale 체계와 실질적으로 정합한다. in-memory per-instance degraded fallback 을 "수용된 trade-off" 로 명시하고 WS §2.2·실행 엔진 §9.2 를 참조하는 방식은 기존 결정(2026-06-02 Redis-only 확정, DB fallback 기각) 을 정확히 계승한다. NF-07 의 single-instance latency 회귀 예산 < 5ms 도 원래 plan 수용 기준 #3 과 동일하다. 유일한 Rationale 정합 보완 과제는 R7 원문이 여전히 "DB row-level lock" 대안을 열거하고 있어 낡았다는 점이며, 이는 target draft 가 §R7 말미에 추가하는 1문장에 폐기 사유를 덧붙이거나 R7 원문을 갱신하는 것으로 해소할 수 있다. CRITICAL 또는 WARNING 에 해당하는 기각된 대안의 재도입, 합의 원칙 위반, 무근거 번복, invariant 우회는 발견되지 않았다.

---

## 위험도

LOW
