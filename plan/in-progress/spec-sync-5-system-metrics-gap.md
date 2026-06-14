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
  - [x] TEST WORKFLOW (lint·unit·build·e2e)
  - [x] /ai-review (2026-06-14 12:32:02 — SUMMARY: Critical 0 / WARNING 12 / INFO 13. 10/12 fix, W-10·W-12 후속 분리)
  - [x] /consistency-check --impl-done (2026-06-14 12:55:52 — BLOCK: NO)

## 후속 (아키텍처 개선 — 이번 PR 조치 안 함)
- W-10: `registerQueueDepthProvider` push-등록 패턴을 `QUEUE_DEPTH_PROVIDER` 다중 주입 DI 토큰 패턴으로 전환 (암묵적 등록 계약 해소)
- W-12: `ExecutionEngineService` 내 `emitTerminalExecutionMetrics` / `recordNodeLatencyMetrics` 를 `ExecutionMetricsCollector` 별도 서비스로 SRP 분리
- I-11: `.env.example` 에 `OTEL_PROMETHEUS_HOST=127.0.0.1` 항목 추가 확인
- I-3: observeQueues provider 실행 타임아웃 (Promise.race 패턴)
- I-12: 다중 Pod cooldown 분산 잠금 (`acquireLock` 패턴)
- I-13: node_executions `(execution_id, status)` 복합 인덱스 존재 확인
- impl-done W-1: `TERMINAL_STATUSES` 공유 상수 통합 (`ExecutionEngineService` static + `external-interaction/interaction.service.ts` 모듈 const 중복 → `execution-status.enum.ts` 또는 공유 util `TERMINAL_EXECUTION_STATUSES`)
- impl-done INFO-6: `business-metrics.service.ts` 의 private `LlmTokenUsage` 를 `llm-client.interface.ts` 의 `TokenUsage`(또는 `Partial<TokenUsage>`) 재활용으로 통합

## 비고
- 근거(claim→코드부재)는 audit findings/5-system/5-system___product-overview.md 참조.
- OTel 트레이싱(NF-OB-03)·구조화 로깅(NF-OB-01) 은 별도로 구현되어 있으므로 본 항목은 메트릭 파이프라인 한정.
