# Cross-Spec 일관성 검토 결과

검토 모드: --impl-prep (구현 착수 전)
Target: `spec/5-system/_product-overview.md`
검토 시각: 2026-06-14

---

## 발견사항

### [WARNING] `4-execution-engine.md` Rationale 의 "OTel traces-only" 표현이 NF-OB-02 ✅ 상태와 충돌

- **target 위치**: `spec/5-system/_product-overview.md` NF-OB-02 행 — OTel MeterProvider + PrometheusExporter 구현 ✅ 로 기술
- **충돌 대상**: `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링 — 로그 기반 알람 선택 (Phase 3.1)" (line ~1380)
  - "**현 backend 는 OTel traces-only** (`instrumentation.ts` — MeterProvider / metrics exporter 미구성, custom Counter/Gauge 0건). DLQ depth 알람 하나를 위해 metrics SDK 파이프라인 전체를 도입하는 것은 Phase 3.1(선택적 후속 정리) 범위에 비해 과도."
- **상세**: `metrics-business` 구현의 직전 단계(NF-OB-02 PR, `feat(observability)` 커밋)에서 OTel MeterProvider + PrometheusExporter 가 이미 `instrumentation.ts` 에 연결됐다. 그런데 `4-execution-engine.md` Rationale 은 그 이전 상태("metrics exporter 미구성")를 사실로 인용하며 DLQ 로그 기반 알람을 정당화한다. metrics SDK 파이프라인이 존재하는 현재 기준으로 Rationale 의 전제("도입 비용이 과도")가 더 이상 성립하지 않는다. Rationale 자체는 이전 결정의 근거 기록이므로 삭제할 필요는 없지만, 현재 상태와의 불일치가 혼란을 야기한다.
- **제안**: `4-execution-engine.md` §"DLQ 모니터링" Rationale 에 "(NF-OB-02 구현 이후 Prometheus 파이프라인 존재 — 추후 메트릭 기반 알람으로 재검토 가능)" 주석을 추가해 과거 결정과 현재 상태를 구분. 또는 비즈니스 메트릭 구현(본 `metrics-business` 태스크) 완료 후 DLQ 알람을 Gauge 기반으로 전환하는 별도 작업을 명시.

---

### [INFO] `data-flow/9-observability.md` 의 `OTEL_PROMETHEUS_HOST` 가 target NF-OB-02 에 누락

- **target 위치**: `spec/5-system/_product-overview.md` NF-OB-02 — "Prometheus scrape 서버(`OTEL_PROMETHEUS_PORT`, 기본 :9464)" 만 언급
- **충돌 대상**: `spec/data-flow/9-observability.md` line ~200 — "`OTEL_PROMETHEUS_HOST`:`OTEL_PROMETHEUS_PORT`/`metrics`, 기본 `127.0.0.1:9464`" 로 HOST 변수 포함
- **상세**: 실제 구현(`codebase/backend/src/instrumentation.ts`, `.env.example` line 322-323)은 `OTEL_PROMETHEUS_HOST`(기본 127.0.0.1)·`OTEL_PROMETHEUS_PORT`(기본 9464) 두 변수를 모두 지원한다. `9-observability.md` 가 양쪽을 올바르게 기술하는 반면, target NF-OB-02 는 `OTEL_PROMETHEUS_PORT` 만 언급해 HOST 설정 가능성을 숨긴다. 기능 오류는 아니나 셀프 호스팅 환경에서 scrape 서버를 0.0.0.0 으로 바인딩해야 하는 경우 혼란 원인이 될 수 있다.
- **제안**: NF-OB-02 상태 셀에 `OTEL_PROMETHEUS_HOST`(기본 127.0.0.1)도 추가해 `9-observability.md` 기술과 동기화.

---

### [INFO] `spec/1-data-model.md` 에 `alert_rule` 엔티티 정의 누락

- **target 위치**: `spec/5-system/_product-overview.md` NF-OB-05 — "룰 CRUD API + `/profile/alerts` UI + `AlertsEvaluatorService`" 언급
- **충돌 대상**: `spec/data-flow/9-observability.md` 헤더 — "[데이터 모델 §2 (alert_rule V016)](../1-data-model.md)" 참조
- **상세**: `9-observability.md` 의 §Source/Sink 표(line ~157)에 `alert_rule` 스키마(`workspace_id, workflow_id?, type, threshold, window_iso, channel, enabled, last_triggered_at?, created_by?` V016)가 상세 기술되어 있으나, `spec/1-data-model.md` §2 에는 `alert_rule` 엔티티가 존재하지 않는다. NF-OB-05 구현이 ✅ 로 표기된 상황에서 `1-data-model.md` 에 해당 엔티티가 없으면 데이터 모델 단일 진실 원칙이 어긋난다.
- **제안**: `spec/1-data-model.md` §2 에 `AlertRule` 엔티티(`V016`) 정의를 추가하고, `9-observability.md` 의 스키마 기술과 동기화. 대안으로 `1-data-model.md` 헤더 주석에 "alert_rule 은 data-flow/9-observability.md §3 이 SoT" 라고 명시.

---

### [INFO] 비즈니스 커스텀 메트릭과 Statistics API 간 책임 경계 미정의

- **target 위치**: `spec/5-system/_product-overview.md` NF-OB-02 — "비즈니스 커스텀 메트릭(실행 수·큐 깊이·LLM 사용량)은 본 파이프라인 위 후속"
- **충돌 대상**: `spec/2-navigation/7-statistics.md` — 실행 횟수·LLM 토큰 사용량(`/api/statistics/llm-usage/summary`, `/timeseries`)을 REST API 로 이미 노출. `spec/data-flow/9-observability.md` §"인프라 메트릭" — 같은 도메인("워크플로 실행 수·LLM 사용량")을 "custom 비즈니스 메트릭"으로 후속 처리.
- **상세**: "워크플로 실행 수"·"LLM 사용량"은 Statistics REST API(`/api/statistics/executions`, `/api/statistics/llm-usage/*`)를 통해 이미 DB 집계로 서빙 중이다. OTel Prometheus 메트릭으로 같은 값을 또 계측할 경우 데이터 소스가 이원화된다(DB 집계 vs Prometheus 시계열). 두 소스의 수치가 집계 기간·지연·granularity 차이로 발산할 수 있으며, 계층 책임(REST 통계 API vs OTel 메트릭)이 불명확하다. 이는 구현 충돌이 아니라 `metrics-business` 구현 착수 전 합의가 필요한 설계 선택이다.
- **제안**: 비즈니스 메트릭 구현 전 scope 를 명확히 정의할 것 — (a) Statistics DB 집계로 서빙되지 않는 인프라 지표(큐 깊이·워커 활성 수·BullMQ 처리량 등)만 OTel 메트릭 대상으로 한정, (b) 실행 수·LLM 사용량은 Prometheus 메트릭 이중 계측 대신 Grafana 가 Statistics API 를 read하는 방향 검토, 또는 (c) 두 소스 병립을 허용하되 단일 진실(SoT)을 spec 에 명시. `spec/5-system/_product-overview.md` NF-OB-02 의 후속 기술에 이 경계를 추가하면 `7-statistics.md`·`9-observability.md` 와의 정합이 맞춰진다.

---

## 요약

`spec/5-system/_product-overview.md` 는 전반적으로 기존 spec 과 직접 모순을 일으키지 않는다. 가장 주의할 점은 `spec/5-system/4-execution-engine.md` Rationale 이 NF-OB-02 구현 이전 상태("OTel traces-only")를 사실로 인용하고 있어 현재 상태와 불일치를 유발한다는 것이다(WARNING). `metrics-business` 구현 착수 전 두 가지를 추가로 합의할 필요가 있다: (1) `spec/1-data-model.md` 에 `alert_rule` 엔티티 기술 추가(INFO), (2) 비즈니스 커스텀 메트릭의 계층 책임 — 이미 Statistics REST API 로 서빙 중인 값(실행 수·LLM 사용량)을 OTel Prometheus 에도 이중 계측할지, 아니면 Statistics API 에 없는 인프라 레이어 지표(큐 깊이·워커 수)만 OTel 대상으로 한정할지 — 을 spec 에 명시하는 것이다(INFO). CRITICAL 발견 없음.

## 위험도

LOW
