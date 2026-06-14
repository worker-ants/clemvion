---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# 5-system NFR — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). `spec/5-system/_product-overview.md` 의 NF-OB-02 를 코드 현실에 맞춰 ❌(미구현) 로 정정하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/_product-overview.md

> **구현 (2026-06-14, impl-system-metrics-prometheus PR)**: 사용자 결정 "최소 OTel 정렬 파이프라인".
> 기존 OTel 스택과 정렬해 `@opentelemetry/exporter-prometheus` 만 직접 의존성 추가, NodeSDK 의
> MeterProvider 에 PrometheusExporter 연결. HTTP 서버 + runtime-node 기본 메트릭 자동 수집.

## 구현 완료
- [x] NF-OB-02 메트릭 수집 및 모니터링 (Prometheus 호환): `instrumentation.ts` 에 `PrometheusExporter` 를 NodeSDK `metricReaders` 로 연결. Prometheus scrape 서버(`OTEL_PROMETHEUS_PORT`, 기본 :9464)의 `/metrics` 로 노출. `OTEL_ENABLED=true` 게이트(traces 와 동시 토글). 의존성 `@opentelemetry/exporter-prometheus@^0.218.0`(기존 OTel 0.218 스택과 동일 라인) 1건 추가 — `sdk-metrics`·`instrumentation-runtime-node` 는 sdk-node/auto-instrumentations transitive 로 기존재. 테스트: `instrumentation.spec.ts`(포트 해석 폴백).

## 후속 (별도 PR)
- [x] 비즈니스 커스텀 메트릭 (2026-06-14, impl-business-metrics PR) — 사용자 결정 "표준 3종 + 노드 지연·에러율". spec `NF-OB-07` 신설(메트릭 카탈로그·라벨·이원화 정책). `BusinessMetricsService`(@Global `MetricsModule`)가 `metrics.getMeter('clemvion.business')` 로 5개 instrument 계측: `clemvion.execution.total{status}`·`clemvion.execution.errors{error_code}`(execution-engine `updateExecutionStatus` 단일 chokepoint)·`clemvion.queue.depth{queue,state}`(observable gauge, execution-engine+continuation 큐 provider 등록)·`clemvion.llm.tokens{model,type}`(`LlmUsageLogService.record` 단일 지점)·`clemvion.node.duration{node_type,status}`(실행 종료 시 node_execution duration). OTEL 비활성 시 no-op meter 로 안전. 테스트: `business-metrics.service.spec.ts`·`llm-usage-log.service.spec.ts`.
  - [x] `continuation-dlq-monitor.service.ts` "OTel traces-only" 주석 현행화 + 큐 depth gauge provider 등록 (C-12).
  - [x] spec W-2: `4-execution-engine.md` §Rationale "DLQ 모니터링" stale 전제 현행화.
  - [ ] TEST WORKFLOW (lint·unit·build·e2e)
  - [ ] /ai-review
  - [ ] /consistency-check --impl-done

## 비고
- 근거(claim→코드부재)는 audit findings/5-system/5-system___product-overview.md 참조.
- OTel 트레이싱(NF-OB-03)·구조화 로깅(NF-OB-01) 은 별도로 구현되어 있으므로 본 항목은 메트릭 파이프라인 한정.
