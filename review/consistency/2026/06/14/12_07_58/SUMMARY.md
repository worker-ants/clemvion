# Consistency Check 통합 보고서

**BLOCK: NO** — Critical 발견 없음. 구현 착수 가능하나 WARNING 2건 선처리 권장.

## 전체 위험도
**MEDIUM** — spec 에 비즈니스 커스텀 메트릭 독립 항목이 없어 구현이 spec 이탈 위험 (Plan Coherence WARNING). `4-execution-engine.md` Rationale 이 현재 상태와 모순된 채 방치(Cross-Spec / Rationale Continuity 중복 WARNING).

## Critical 위배 (BLOCK 사유)

없음.

## 경고 (WARNING)

| # | Checker | 위배 | target 위치 | 충돌 대상 | 제안 |
|---|---------|------|-------------|-----------|------|
| W-1 | Plan Coherence | 비즈니스 커스텀 메트릭에 대응하는 독립 NF 항목(ID·이름·라벨 셋) 미정의 — plan 에도 "합의 필요" 미결 | `spec/5-system/_product-overview.md` §5 NF-OB-02 상태 열 주석 | `plan/in-progress/spec-sync-5-system-metrics-gap.md` §후속 첫 번째 항목 | `spec/5-system/_product-overview.md` §5 에 NF-OB-07(또는 적절한 ID)을 신설해 도메인(실행 수·큐 깊이·LLM 토큰), OTel 명명 규칙, 라벨 셋을 명시한 후 구현 착수 |
| W-2 | Cross-Spec / Rationale Continuity (통합) | `4-execution-engine.md` §Rationale "DLQ 모니터링" 이 NF-OB-02 구현 이전 상태("OTel traces-only / MeterProvider 미구성")와 "OTel Meter Gauge 미채택" 기각 항목을 그대로 유지 — 현재 상태와 모순 | `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링 — 로그 기반 알람 선택 (Phase 3.1)" (line ~1380) | `spec/5-system/_product-overview.md` NF-OB-02 ✅ 및 commit b9df69bf | (1) "현 backend 는 OTel traces-only" 전제를 "NF-OB-02(commit b9df69bf) 이후 MeterProvider + PrometheusExporter 구성됨"으로 정정, (2) 기각 사유를 "Phase 3.1 당시 판단"으로 한정 명시 또는 DLQ Gauge 전환 후속 검토 항목으로 재기술 |

## 참고 (INFO)

| # | Checker | 항목 | 위치 | 제안 |
|---|---------|------|------|------|
| I-1 | Cross-Spec | `OTEL_PROMETHEUS_HOST` 환경 변수가 NF-OB-02 기술에서 누락 | `spec/5-system/_product-overview.md` NF-OB-02 상태 열 | `OTEL_PROMETHEUS_HOST`(기본 127.0.0.1) 추가해 `spec/data-flow/9-observability.md` 기술과 동기화 |
| I-2 | Cross-Spec | `spec/1-data-model.md` §2 에 `alert_rule` 엔티티(V016) 정의 누락 — NF-OB-05 ✅ 인데 데이터 모델 단일 진실 미반영 | `spec/1-data-model.md` | `AlertRule` 엔티티 추가 또는 "SoT = data-flow/9-observability.md §3" 주석 명시 |
| I-3 | Cross-Spec | 실행 수·LLM 사용량을 Statistics REST API(DB 집계)와 OTel Prometheus 양쪽에서 계측할 경우 데이터 소스 이원화 가능성 | `spec/5-system/_product-overview.md` NF-OB-02 / `spec/2-navigation/7-statistics.md` | 비즈니스 메트릭 scope 확정 전 (a) OTel 대상을 인프라 지표(큐 깊이·워커 수)로 한정, (b) Grafana → Statistics API 방향 검토, 또는 (c) SoT 명시 중 하나를 spec 에 결론 반영 |
| I-4 | Plan Coherence | `continuation-dlq-monitor.service.ts` 내 "OTel traces-only" 주석 현행화 미완 — 본 구현 PR 후 더 stale 해짐 | 코드 내 주석 (`codebase/backend`) | 구현 PR 에서 함께 갱신하거나 plan 에 별도 체크박스로 이관 명시 |
| I-5 | Convention Compliance | `spec/5-system/_product-overview.md` 에 `## Overview` / `## Rationale` 3섹션 구조 미적용 | `spec/5-system/_product-overview.md` 전체 구조 | 구조적 결정 배경 있으면 말미에 `## Rationale` 절 추가 (규약이 "권장"이라 필수 아님) |
| I-6 | Naming Collision | NF-OB-02, AGM-01~13, `agent-memory-extraction` 큐명, `OTEL_PROMETHEUS_PORT` ENV 키 — 코퍼스 내 의미 충돌 없음 | `spec/5-system/_product-overview.md` | 조치 불요 |

## Checker별 위험도

| Checker | 위험도 | 핵심 발견 |
|---------|--------|-----------|
| Cross-Spec | LOW | `4-execution-engine.md` Rationale stale (WARNING) + `OTEL_PROMETHEUS_HOST` 누락·`alert_rule` 미정의·메트릭 이원화 우려 (INFO) |
| Rationale Continuity | LOW | `4-execution-engine.md` §Rationale "OTel traces-only" 전제·Gauge 기각 항목이 NF-OB-02 구현과 모순 (WARNING, Cross-Spec W-2 와 통합) |
| Convention Compliance | NONE | 3섹션 구조 미완성(INFO), 핵심 규약 준수 |
| Plan Coherence | MEDIUM | 비즈니스 커스텀 메트릭 독립 NF 항목 미정의 (WARNING) — 구현 착수 전 spec 선행 정의 필요 |
| Naming Collision | NONE | 모든 식별자 정합 확인, 충돌 없음 |

## 권장 조치사항

1. **(구현 착수 전 선행 필수 — W-1)** `spec/5-system/_product-overview.md` §5 에 `NF-OB-07`(또는 적절한 연번 ID)을 신설해 비즈니스 커스텀 메트릭의 대상 도메인, OTel 메트릭 이름 규칙, 라벨 셋을 명시한다. `plan/in-progress/spec-sync-5-system-metrics-gap.md` 의 "메트릭 이름/라벨 셋 합의 필요" 미결 항목에 spec 정의 완료 체크박스를 선행 조건으로 표기한다.
2. **(구현 PR 에서 또는 별도 spec-sync 작업 — W-2)** `spec/5-system/4-execution-engine.md` §Rationale "DLQ 모니터링" 항의 "OTel traces-only" 전제를 NF-OB-02 구현 이후 현실 반영으로 정정하고, Gauge 기각 사유를 "Phase 3.1 당시 판단" 으로 한정 명시한다.
3. **(I-3 — 착수 전 결론 필요)** 실행 수·LLM 사용량의 OTel 이중 계측 여부를 결정해 NF-OB-07 scope 에 반영한다. Statistics API 가 이미 서빙 중인 값은 인프라 레이어 지표(큐 깊이·워커 수 등)와 명확히 구분할 것.
4. **(I-2 — 후속 정리)** `spec/1-data-model.md` §2 에 `AlertRule` 엔티티(V016) 추가 또는 `data-flow/9-observability.md §3` SoT 주석 명시.
5. **(I-4 — 구현 PR 내)** `continuation-dlq-monitor.service.ts` 내 "OTel traces-only" 주석을 본 PR 에서 함께 현행화하거나 plan 에 별도 체크박스로 이관.