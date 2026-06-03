---
worktree: spec-sync-audit
started: 2026-06-03
owner: planner
---

# 5-system NFR — spec 약속 대비 미구현 surface

> 출처: 2026-06-03 spec-vs-code audit (review/spec-coverage/2026/06/03/08_05_49). `spec/5-system/_product-overview.md` 의 NF-OB-02 를 코드 현실에 맞춰 ❌(미구현) 로 정정하며 분리한 미구현 항목 추적.
> 관련 spec: spec/5-system/_product-overview.md

## 미구현 항목
- [ ] NF-OB-02 메트릭 수집 및 모니터링 (Prometheus 호환): 백엔드에 메트릭 surface 부재. `@opentelemetry/exporter-trace-otlp-http` (traces-only) 만 존재하고 `@opentelemetry/sdk-metrics`·`@opentelemetry/exporter-prometheus`·`prom-client`·`/metrics` 엔드포인트·`MeterProvider` 모두 없음. `codebase/backend/src/instrumentation.ts` 는 `OTLPTraceExporter` 만 구성. `continuation-dlq-monitor.service.ts:30` 주석도 "현 backend 는 OTel traces-only" 명시.

## 비고
- 근거(claim→코드부재)는 audit findings/5-system/5-system___product-overview.md 참조.
- OTel 트레이싱(NF-OB-03)·구조화 로깅(NF-OB-01) 은 별도로 구현되어 있으므로 본 항목은 메트릭 파이프라인 한정.
