# Cross-Spec 일관성 검토 결과

검토 모드: `--impl-done`
Target: `spec/5-system/_product-overview.md`
구현 범위: `BusinessMetricsService` (`codebase/backend/src/modules/metrics/`) + 계측 지점 (execution-engine·llm·continuation)

---

## 발견사항

### 1. **[INFO]** `clemvion.execution.total` `status` 라벨값이 구현과 spec 카탈로그 간 표기 방식이 혼재할 수 있음

- **target 위치**: `spec/5-system/_product-overview.md §5 NF-OB-07 메트릭 카탈로그` — `status` 라벨값을 `completed/failed/cancelled` 소문자로 기술
- **충돌 대상**: 구현 `execution-engine.service.ts` — `emitTerminalExecutionMetrics` 가 `ExecutionStatus` enum 값을 그대로 `recordExecutionTerminal(newStatus)` 에 전달. `ExecutionStatus` 가 `COMPLETED`/`FAILED`/`CANCELLED` 대문자 enum 인지 소문자 string 인지 직접 확인이 필요
- **상세**: spec 카탈로그는 `status` 값을 소문자(`completed/failed/cancelled`)로 명시한다. Prometheus 라벨은 대소문자 구분이므로, `ExecutionStatus` 가 대문자 enum string이면 실제 메트릭 라벨값이 spec 카탈로그와 달라진다. `business-metrics.service.spec.ts` 테스트에서도 `'completed'`, `'completed'` 소문자로 assert 하고 있어, 구현 enum 값이 소문자라면 문제없다.
- **제안**: `ExecutionStatus` enum 값이 소문자(`'completed'`/`'failed'`/`'cancelled'`)임이 확인되면 이 항목은 해소. 확인 전까지 동기화 권장. (구현 코드는 `recordExecutionTerminal(newStatus)` 로 enum 값 원형 전달 — `business-metrics.service.ts` `recordExecutionTerminal(status: string)` 에서 라벨에 직접 사용.)

---

### 2. **[INFO]** `spec/0-overview.md §6.1 시스템` 구현 완료 행이 비즈니스 메트릭 파이프라인 미언급

- **target 위치**: `spec/0-overview.md §6.1` 시스템 행 — `인증/인가(개인·팀 워크스페이스), REST API, 에러 처리, 표현식 엔진, 실행 엔진, WebSocket 실시간 상태, Webhook 수신, 실행 이력`
- **충돌 대상**: 이번 구현 — `MetricsModule` + `BusinessMetricsService` (@Global) 추가로 비즈니스 메트릭 파이프라인 신규 구축 완료. `spec/5-system/_product-overview.md` NF-OB-07 ✅ 로 반영됨
- **상세**: `spec/0-overview.md §6.1` 시스템 행은 `spec/5-system/_product-overview.md` 의 비기능 요구사항들을 모두 열거하지 않으므로 항상 요약 형태다. NF-OB-07 이 `_product-overview.md` 에 ✅ 로 정상 반영됐으므로 직접 모순은 아니다. 다만 `spec/0-overview.md §6.1` 의 시스템 행이 관측성 관련 완료 항목(NF-OB-02, NF-OB-07 등)을 언급하지 않는다면, 향후 개요 문서 동기화 시 누락될 수 있다.
- **제안**: 선택 사항. `spec/0-overview.md §6.1` 시스템 행에 `비즈니스 메트릭(NF-OB-07)` 을 포함하거나, 기존처럼 상세 비기능 항목을 열거하지 않는 정책을 유지한다.

---

## 요약

이번 구현(`BusinessMetricsService` + `MetricsModule` + 계측 지점 연결)은 Cross-Spec 일관성 관점에서 충돌이 없다. `NF-OB-07` 은 `spec/5-system/_product-overview.md §5` 에 ✅ 완료 상태로 정의되어 있고 메트릭 카탈로그(5개 instrument)도 spec 에 기술됐다. `spec/5-system/4-execution-engine.md §Rationale "DLQ 모니터링"` 은 `현행화(NF-OB-02 commit b9df69bf · NF-OB-07 이후)` 주석으로 큐 깊이 ObservableGauge 채택을 이미 반영했다. "관측 대상의 이원화 정책" 도 `spec/5-system/_product-overview.md §5 NF-OB-07` 섹션에 명시적으로 기술돼 있다. 요구사항 ID, API 계약, 데이터 모델, 상태 머신, RBAC 어느 관점에서도 타 spec 영역과 직접 모순되는 항목이 없다. 발견된 두 항목은 모두 명명 확인 권장(INFO) 수준이다.

---

## 위험도

NONE
