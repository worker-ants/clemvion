# 요구사항(Requirement) 리뷰 결과

## 리뷰 대상

- `codebase/backend/package.json` — `@opentelemetry/exporter-prometheus@^0.218.0` 의존성 추가
- `codebase/backend/package-lock.json` — lockfile 갱신
- `codebase/backend/src/instrumentation.ts` — PrometheusExporter + NodeSDK MeterProvider 연결 (재작성)
- `codebase/backend/src/instrumentation.spec.ts` — 신규 테스트 파일
- `plan/in-progress/spec-sync-5-system-metrics-gap.md` — 구현 완료 체크박스 갱신
- `spec/5-system/_product-overview.md` — NF-OB-02 상태 ❌→✅ 갱신

관련 spec: `spec/5-system/_product-overview.md` NF-OB-02, `spec/data-flow/9-observability.md`

---

## 발견사항

### - **[INFO]** `continuation-dlq-monitor.service.ts` 의 "OTel traces-only" 주석이 현행화되지 않음
- 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts:30`
- 상세: 해당 파일 line 30 에 `현 backend 는 OTel traces-only, custom metric` 주석이 남아 있다. 이번 구현으로 traces-only 가 아니라 traces + metrics 파이프라인이 갖춰졌으므로 주석이 구 현실을 기술한다. 기능적 결함은 아니나 코드 주석 부정확 문제.
- 제안: plan `## 후속` 에 이미 `continuation-dlq-monitor.service.ts 의 "OTel traces-only" 주석 현행화` 가 후속 작업으로 추적되고 있으므로 현 PR 에서 fix 필수는 아님. 후속 PR 에서 처리.

### - **[INFO]** `OTEL_ENABLED=false`(기본) 일 때 metrics 서버가 뜨지 않음 — 게이트 동작 문서화는 양호
- 위치: `instrumentation.ts:43-83`
- 상세: traces 와 metrics 가 동일한 `OTEL_ENABLED` 게이트로 함께 토글된다. Prometheus scrape 가 활성되려면 반드시 `OTEL_ENABLED=true` 설정이 필요하며, 이는 spec(`_product-overview.md` NF-OB-02 갱신 본문, `instrumentation.ts` 파일 주석) 모두에 명시돼 있다. 기능 불완전은 아니나 운영자 인지가 필요한 조건.

### - **[SPEC-DRIFT]** `spec/data-flow/9-observability.md §1.4` 내 시스템 상태 흐름 다이어그램/본문이 메트릭 파이프라인 관련 정보를 포함하지 않음
- 위치: `spec/data-flow/9-observability.md`
- 상세: `data-flow/9-observability.md` 는 Health check·Dashboard·Statistics·Alerts 를 다루지만 NF-OB-02 Prometheus 메트릭 파이프라인(`instrumentation.ts`, scrape 포트, auto-instrumentation 메트릭)에 대한 언급이 없다. 코드 구현은 합리적이고 의도적으로 완성됐으며, 되돌리는 것이 아닌 spec 문서 갱신이 필요한 케이스다. 코드는 옳고, `data-flow/9-observability.md` 에 메트릭 파이프라인 개요(엔드포인트·포트·환경변수·auto-instrumentation 범위)를 추가하는 것이 spec 반영 경로.
- 제안: 코드 유지 + `spec/data-flow/9-observability.md` 에 §1.x "Prometheus 메트릭 파이프라인" 절 추가 (`project-planner` 위임). `_product-overview.md` NF-OB-02 는 이미 이번 PR 에서 갱신됨.

### - **[INFO]** `sdk.start()` 예외가 catch 되어 silent fallback 됨
- 위치: `instrumentation.ts:71-78`
- 상세: `sdk.start()` 실패 시 `console.warn` 으로 기록 후 계속 진행한다. Prometheus 서버가 실제로 뜨지 않아도 애플리케이션 부트는 계속된다. 이는 의도적 방어적 설계로(부트스트랩 코드 주석에도 명시), 관측성 인프라 장애가 서비스 전체를 중단시키지 않게 한다. 기능 결함 아님.

### - **[INFO]** 테스트 범위 제한 — `NodeSDK` + `PrometheusExporter` 부수효과는 테스트되지 않음
- 위치: `instrumentation.spec.ts`
- 상세: `resolvePrometheusPort` 순수 함수만 검증하고, 실제 `sdk.start()` + Prometheus HTTP 서버 기동·`/metrics` 엔드포인트 응답은 테스트되지 않는다. 파일 주석에 이 제한의 근거(`OTEL_ENABLED` 게이트로 import 시 서버가 뜨지 않음)가 명시돼 있다. e2e 에서 `OTEL_ENABLED=true` 환경으로 `/metrics` scrape 검증을 추가하면 더 완전하나, 현 PR scope 내 필수 요건은 아님(비즈니스 커스텀 메트릭 추가 시 함께 검토 권장).

---

## 요약

이번 변경은 NF-OB-02(Prometheus 호환 메트릭 수집·모니터링)를 충족하기 위한 최소 OTel 정렬 파이프라인 구현이다. `@opentelemetry/exporter-prometheus@^0.218.0` 의존성 1건을 기존 OTel 0.218 스택과 버전 일치로 추가하고, `instrumentation.ts` 에 `PrometheusExporter` 를 NodeSDK `metricReaders` 로 연결해 Prometheus scrape 서버(기본 `:9464/metrics`)를 기동한다. 환경변수 게이트(`OTEL_ENABLED`)·포트 해석 폴백(`OTEL_PROMETHEUS_PORT`)·오류 시 서비스 불중단 방어 모두 적절히 구현됐다. `resolvePrometheusPort` 의 경계값(undefined·공백·비숫자·범위 외) 처리는 테스트로 검증됐다. spec `_product-overview.md` NF-OB-02 상태 갱신과 plan 파일 체크박스 완료 표시도 포함돼 있다. 비즈니스 커스텀 메트릭과 `continuation-dlq-monitor.service.ts` 주석 현행화는 후속 PR 추적으로 명시됐다. 기능 완전성·비즈니스 로직·에러 경로·반환값 측면에서 의도한 요구사항(최소 파이프라인 수립)을 충족한다.

## 위험도

LOW
