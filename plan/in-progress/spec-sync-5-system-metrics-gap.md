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

## 후속 (별도 PR — 본 PR 범위 밖)
- [ ] 비즈니스 커스텀 메트릭: 워크플로 실행 수·큐 깊이·LLM 토큰 사용량 등 도메인 메트릭 정의·계측 (메트릭 이름/라벨 셋 합의 필요).
- [ ] `continuation-dlq-monitor.service.ts` 의 "OTel traces-only" 주석 현행화(메트릭 포함).

## 비고
- 근거(claim→코드부재)는 audit findings/5-system/5-system___product-overview.md 참조.
- OTel 트레이싱(NF-OB-03)·구조화 로깅(NF-OB-01) 은 별도로 구현되어 있으므로 본 항목은 메트릭 파이프라인 한정.
