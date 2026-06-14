# Rationale 연속성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
대상 scope: `spec/5-system/_product-overview.md` (구현 diff 기반)
검토 일시: 2026-06-14

---

## 발견사항

### 정합 — DLQ Rationale 갱신 확인 (기각된 대안 재도입 여부)

과거 `spec/5-system/4-execution-engine.md § Rationale "DLQ 모니터링 — 로그 기반 알람 선택 (Phase 3.1)"` 은 다음을 명시적으로 **기각**했다:

> (a) OTel Meter Gauge 신설 — 메트릭 백엔드(수집기/대시보드) 부재 상태에서 소비처 없는 메트릭. metrics 파이프라인 구축 시 재검토.

구현 diff 는 `ContinuationDlqMonitorService` 에 `BusinessMetricsService.registerQueueDepthProvider` 를 주입해 큐 깊이를 `clemvion.queue.depth` ObservableGauge 로 노출한다. 이는 형식적으로 위 기각 사항 (a) — "OTel Meter Gauge 신설" — 을 다시 채택하는 것처럼 보인다.

그러나 워크트리의 현행 `spec/5-system/4-execution-engine.md` (라인 1380–1381) 는 해당 Rationale 항목 안에 다음 현행화 주석을 명시적으로 추가했다:

> **(당시 전제 — 이후 변경됨)** Phase 3.1 시점의 backend 는 OTel traces-only 였다 (MeterProvider 미구성, custom 메트릭 0건). DLQ depth 알람 하나를 위해 metrics SDK 파이프라인 전체를 도입하는 것은 과도했다.
> **현행화 (NF-OB-02 commit b9df69bf · NF-OB-07 이후)**: 이제 MeterProvider + PrometheusExporter 가 구성됐고, 큐 깊이(DLQ 의 `failed`/`delayed` 포함)는 `clemvion.queue.depth` ObservableGauge 로 노출된다. 다만 `ContinuationDlqMonitorService` 의 임계 초과 알람(능동 통지)은 여전히 log 기반을 유지한다 — gauge 는 "관측"이고 cooldown 알람은 "통지"라 역할이 다르며, 알람 룰은 Prometheus/Grafana 또는 로그 알람 어느 쪽으로도 구성 가능하다.

기각 사항 (a) 재도입은 "metricspaipeline 부재" 전제 소멸 이후의 의도적 번복으로, Rationale 내 현행화 주석으로 근거가 명시됐다. **Rationale 연속성 관점에서 무근거 번복이 아니다.**

추가로 임계 초과 알람(능동 통지)은 여전히 log 기반을 유지하여 원래 Rationale 의 "cooldown 로그 알람 기반" 원칙의 핵심을 보존한다. gauge(관측)와 log(통지) 역할 분리는 구현 코드(`continuation-dlq-monitor.service.ts` 주석: "근거: spec/5-system/4-execution-engine.md §Rationale 'DLQ 모니터링'")와 spec 양쪽에서 일치하게 명시된다.

---

### **[INFO]** `_product-overview.md` NF-OB-07 행에 "이원화 정책" 원칙 참조 명시

- **target 위치**: `spec/5-system/_product-overview.md` NF-OB-07 (워크트리, 라인 75–89)
- **관련 Rationale**: `_product-overview.md` NF-OB-07 카탈로그 아래 "관측 대상의 이원화 정책 (vs Statistics API)" 단락 — "OTel 메트릭은 운영 관측을 위한 보조 노출이며 제품 데이터의 단일 진실이 아니다."
- **상세**: 이 이원화 정책은 현행 워크트리 spec 안에 NF-OB-07 정의 바로 아래 인라인으로 명문화되어 있다. 구현 코드(`business-metrics.service.ts` JSDoc)도 동일 원칙을 "본 메트릭은 운영 관측·알람(Prometheus/Grafana)용 보조 노출이며, 제품 분석의 SoT 는 DB 집계 기반 Statistics API 다" 로 명시한다. 정합성 문제는 없다. 다만 이 이원화 원칙이 향후 코드 변경(예: OTel 카운터를 Statistics API 의 SoT 로 오용)을 방지하는 guard 로 유효하려면, 별도 `## Rationale` 절(현재 NF-OB-07 전용 항목 없음)에서 이 원칙을 "기각 대안 포함 ADR" 형태로 정식화하는 것이 보강 방안이다.
- **제안**: 선택적 보완 — `spec/5-system/_product-overview.md § Rationale` 에 "NF-OB-07 — OTel 보조 메트릭과 Statistics API SoT 이원화" 항목을 ADR 형태로 추가하면, "OTel 카운터를 분석 SoT 로 승격"이 향후 Rationale 연속성 검토에서 곧바로 포착된다. 현재 인라인 기술 수준도 원칙 명시 자체는 충분하므로 즉각 차단 사안은 아니다.

---

### **[INFO]** `plan/in-progress/spec-sync-5-system-metrics-gap.md` 후속 항목 체크 상태 미갱신

- **target 위치**: `/Volumes/project/private/clemvion/plan/in-progress/spec-sync-5-system-metrics-gap.md` 라인 20 — "[ ] 비즈니스 커스텀 메트릭: 워크플로 실행 수·큐 깊이·LLM 토큰 사용량 등 도메인 메트릭 정의·계측"
- **과거 결정 출처**: 해당 plan 파일은 NF-OB-02 구현 PR 완료 후 "비즈니스 커스텀 메트릭은 후속(별도 PR)" 으로 분리 추적. 현재 구현 diff 는 그 후속을 완료했다.
- **상세**: Rationale 연속성 문제가 아니라 plan lifecycle 문제다. 구현은 완료됐으나 plan 파일의 체크박스가 갱신되지 않아 추적 상태가 실제와 불일치한다.
- **제안**: 완료 후 `[x]` 로 갱신하거나, 본 task 완료 시 `plan/complete/` 로 이동 (plan-lifecycle.md 규약 준수).

---

## 요약

Rationale 연속성 관점에서 심각한 위반은 없다. 가장 민감한 지점인 "DLQ depth OTel Gauge 신설 — Phase 3.1 에서 명시적으로 기각된 대안" 재도입은, 워크트리 spec 의 Rationale 현행화 주석이 전제 변화("OTel traces-only" → MeterProvider 구성 완료)를 명시하고 번복 근거를 갖춤으로써 무근거 번복이 아닌 근거 있는 Rationale 갱신으로 처리됐다. 핵심 합의 원칙("임계 초과 알람은 log 기반, 관측과 통지 역할 분리")도 구현과 spec 양쪽에서 일관되게 유지된다. "관측 대상의 이원화 정책"(OTel 보조, Statistics API SoT)은 spec 인라인에 명시되어 있고 구현 JSDoc 에도 반영됐다. INFO 수준의 보완 제안(이원화 정책의 ADR 형식 정식화, plan 체크박스 갱신)만 존재하며 구현을 차단하거나 번복시킬 CRITICAL/WARNING 사항은 발견되지 않았다.

## 위험도

NONE

STATUS: SUCCESS
