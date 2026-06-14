# 변경 범위(Scope) 리뷰

## 발견사항

### [WARNING] execution-engine.service.spec.ts — BusinessMetricsService 중복 등록
- 위치: 파일 4, diff 라인 `+          BusinessMetricsService,` (두 번째 등록, `describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트')` 블록)
- 상세: `BusinessMetricsService` 가 동일 `createTestingModule` providers 배열에 두 번 연속 등록돼 있다. NestJS 는 중복 provider 를 덮어쓰므로 실제 동작은 무해하지만, 명백한 실수(copy-paste 오류)다. 범위 이탈이 아니라 구현 품질 결함.
- 제안: 두 항목 중 하나를 제거한다.

### [INFO] continuation-dlq-monitor.service.ts — enabled=false 시에도 queue depth gauge 등록
- 위치: 파일 3, `onModuleInit` — `registerQueueDepthProvider` 호출이 `if (!this.config.enabled)` 블록 이전에 위치
- 상세: 변경 의도("알람이 비활성이어도 깊이 관측은 유효")는 주석으로 명확히 기술돼 있어 의도된 설계다. 범위 이탈 아님.

### [INFO] spec/5-system/4-execution-engine.md — Rationale 섹션 현행화
- 위치: 파일 12, DLQ 모니터링 단락
- 상세: 이전 Rationale 의 "OTel traces-only" 전제가 NF-OB-02 구현 이후 stale 해졌고 이번 NF-OB-07 구현으로 완전히 무효화됐다. 주석 현행화는 plan 파일(`spec-sync-5-system-metrics-gap.md`)에도 C-12·W-2 항목으로 명시돼 있어 의도된 범위 내다. 내용 변경도 spec 사실과 일치한다.

### [INFO] spec/5-system/_product-overview.md — NF-OB-02 항목 경미한 수정 포함
- 위치: 파일 13, NF-OB-02 행
- 상세: `OTEL_PROMETHEUS_HOST` 환경변수 추가와 기본값(`127.0.0.1:9464`) 명세 수정이 NF-OB-07 항목 추가와 함께 포함됐다. 이는 NF-OB-07 PR 범위보다 조금 넓지만, 내용이 이미 구현된 사실(NF-OB-02 commit `b9df69bf`)의 단순 문서 정정이므로 실질적 위험은 없다.

---

## 요약

전체 변경은 NF-OB-07 비즈니스 커스텀 메트릭 구현이라는 단일 목적에 집중돼 있다. 신규 파일(`business-metrics.service.ts`, `metrics.module.ts`, 해당 spec)과 기존 서비스 3종(`execution-engine.service.ts`, `continuation-dlq-monitor.service.ts`, `llm-usage-log.service.ts`) 및 대응 테스트 파일만 수정됐으며, 불필요한 리팩토링·포맷팅 변경·무관 기능 추가는 없다. 유일한 실질 결함은 `execution-engine.service.spec.ts` 의 `BusinessMetricsService` 중복 등록(copy-paste 오류)이며, 이는 범위 일탈이 아닌 구현 품질 버그다. `spec/5-system/_product-overview.md` 의 NF-OB-02 경미 문서 정정은 동일 파일 편집 중 병행된 사실 수정으로 수용 가능하다.

## 위험도

LOW
