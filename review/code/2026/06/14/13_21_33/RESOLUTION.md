# RESOLUTION — 13_21_33 (NF-OB-07 2차 리뷰, rebase 후)

본 리뷰는 origin/main rebase(#597·#596·#598 통합) 후 freshness 회복용 재리뷰다.
1차 리뷰(12_32_02)의 Critical 0 / WARNING 12 는 이미 fix(commit `fix(observability)…`)+RESOLUTION 으로 해소됐고, 본 2차는 그 해소 상태를 전수 재검증했다.

## 조치 항목

| SUMMARY # | 분류 | 조치 | 비고 |
|-----------|------|------|------|
| WARNING 1 | 보류(plan 기록 완료) | — | `registerQueueDepthProvider` push 패턴 → DI 토큰 전환 = **plan W-10**. 단기 안전성 확보됨(snapshot 이터레이션·private readonly). 중기 아키텍처 개선. |
| WARNING 2 | 보류(plan 기록 완료) | — | `ExecutionMetricsCollector` SRP 분리 + node-latency JOIN 부하 = **plan W-12**. 중기. |
| INFO 다수 | 보류·후속 | — | 아래 §보류·후속 참조 |

> 2건의 WARNING 은 **모두 1차 리뷰에서 식별·plan 후속(W-10/W-12)으로 분리 결정된 중기 아키텍처 기술부채**이며, 본 PR 의 NF-OB-07 기능·안전성에는 영향 없음(요구사항·scope 리뷰어 NONE). 코드 추가 변경 없이 plan 추적으로 종결.

## TEST 결과

- lint  : 통과 (rebase 후 재수행)
- unit  : 통과 (40 passed, rebase 후 재수행)
- build : 통과 (rebase 후 재수행 — #598 typed-error 통합 포함)
- e2e   : 통과 (190/190, rebase 후 재수행)

## 보류·후속 항목

`plan/in-progress/spec-sync-5-system-metrics-gap.md` §후속(아키텍처/하드닝)에 등재:
- WARNING 1 → W-10 (queue depth provider DI 토큰화)
- WARNING 2 → W-12 (ExecutionMetricsCollector 분리 + node_executions `(execution_id,status)` 인덱스)
- INFO #2/#7/#15 (음수 토큰 `> 0` 명시 검증 + 음수 테스트) — 저위험 하드닝
- INFO #1 (label cardinality 클램핑 model/node_type) / #3 (provider 타임아웃 I-3) / #4 (`LlmTokenUsage`→`TokenUsage` 통합, impl-done INFO-6 과 동일)
- INFO #11~14 (테스트 보강: 합산 관측·구체 큐이름 단언·onModuleInit provider 호출 검증)
- INFO #18~22 (JSDoc·spec bucket 정책·`.env.example` 도메인 메트릭 주석)

> 본 PR 에서 추가 코드 변경 시 review freshness 가 다시 깨지므로, INFO 하드닝은 후속 PR 로 묶어 일괄 처리한다.
