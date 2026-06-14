# Rationale 연속성 검토 결과

검토 모드: `--impl-prep` (구현 착수 전)
Target: `spec/5-system/_product-overview.md`

---

## 발견사항

### 발견사항 1

- **[WARNING]** OTel Meter Gauge 신설 — 기각된 대안의 번복이나 execution-engine.md Rationale 미갱신
  - target 위치: `spec/5-system/_product-overview.md` §5 NF-OB-02 행 (line 70)
  - 과거 결정 출처: `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링 — 로그 기반 알람 선택 (Phase 3.1)" (line 1380–1382)
  - 상세: execution-engine.md Rationale 은 DLQ 모니터링 결정의 근거로 **"현 backend 는 OTel traces-only (`instrumentation.ts` — MeterProvider / metrics exporter 미구성, custom Counter/Gauge 0건)"** 이라는 전제를 명시하고, "택하지 않은 방향 (a): OTel Meter Gauge 신설 — 메트릭 백엔드(수집기/대시보드) 부재 상태에서 소비처 없는 메트릭"으로 기록했다. 이후 commit b9df69bf(NF-OB-02 구현)가 정확히 이 기각된 경로 — MeterProvider + `@opentelemetry/exporter-prometheus` — 를 도입했다. target NF-OB-02 행은 구현 완료(✅)를 올바르게 반영하나, execution-engine.md Rationale은 "traces-only / MeterProvider 미구성" 상태와 "OTel Meter Gauge 미채택" 기각 사유를 그대로 유지하고 있어 두 spec이 모순 상태다. target 자체의 문제가 아니라, NF-OB-02 구현으로 인해 execution-engine.md Rationale의 전제("traces-only")와 기각 항목("OTel Meter Gauge")이 현실과 괴리된 채 방치된 것이다.
  - 제안: `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링" 항을 다음과 같이 갱신한다. (1) "현 backend 는 OTel traces-only" 전제를 "NF-OB-02(commit b9df69bf) 이후 MeterProvider + PrometheusExporter 가 구성됨"으로 정정. (2) "택하지 않은 방향 (a) OTel Meter Gauge 신설" 기각 사유를 "DLQ 알람 시점(Phase 3.1) 당시의 판단" 임을 명시하거나, 현재 메트릭 파이프라인이 활성화된 이상 DLQ depth 를 Gauge 로 노출하는 후속 전환 검토 항목으로 재기술. target 파일(`_product-overview.md`) 자체는 수정 불필요.

---

## 요약

target 문서(`spec/5-system/_product-overview.md`)의 NF-OB-02 행은 실제 구현(OTel MeterProvider + Prometheus exporter 활성)을 올바르게 기술하고 있어 내부적으로 일관성이 있다. 그러나 `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링" 항이 NF-OB-02 구현 전 기록된 "OTel traces-only / MeterProvider 미구성" 전제와 "OTel Meter Gauge 미채택" 기각 사유를 업데이트하지 않아, 두 spec 문서 간 Rationale 정합이 깨진 상태다. target 자체의 직접 위반은 없으나, 관련 Rationale(execution-engine.md) 이 현실을 반영하지 못하는 stale 상태가 방치되면 향후 구현자가 이미 도입된 metrics 파이프라인을 "기각된 대안"으로 오인할 위험이 있다.

---

## 위험도

LOW
