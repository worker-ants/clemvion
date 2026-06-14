# RESOLUTION — impl-system-metrics-prometheus ai-review 후속

대상 SUMMARY: `review/code/2026/06/14/09_25_36/SUMMARY.md` (RISK LOW, Critical 0, Warning 6)

## 조치 내역

### W1 (Security) — `/metrics` loopback 바인딩 [FIXED]
- `instrumentation.ts`: `PrometheusExporter({ host, port })` — `OTEL_PROMETHEUS_HOST` 추가, 기본 `127.0.0.1`(secure-by-default). 컨테이너/원격 scrape 는 env override(`0.0.0.0`) + 네트워크 ACL 권장(헤더 JSDoc 명시).

### W2 (Security) — 에러 메시지만 로깅 [FIXED]
- `console.warn(..., err instanceof Error ? err.message : String(err))` — 원본 Error 객체(스택/경로/URL) 직접 출력 제거.

### W3 (Side-Effect) — 시작 실패 시 exporter 서버 정리 [FIXED]
- `PrometheusExporter` 는 생성 시 즉시 listen 하므로 `sdk.start()` 실패 시 포트 점유 잔류 → catch 에서 `prometheusExporter.stopServer()` 호출.

### W4 (Side-Effect) — SIGTERM 핸들러 중복 방지 [FIXED]
- `process.on('SIGTERM')` → `process.once('SIGTERM')` (모듈 재실행/테스트 isolateModules 대비).

### W5 (Testing) — 부트스트랩 분기 커버 [FIXED]
- `instrumentation.spec.ts`: OTel 모듈 mock + `jest.isolateModules` 로 `OTEL_ENABLED=true` 경로 3케이스 추가 —
  (a) PrometheusExporter `{host:'127.0.0.1', port:9999}` 생성 + `sdk.start()` 호출,
  (b) `OTEL_PROMETHEUS_HOST` override 반영,
  (c) `sdk.start()` throw 시 `stopServer()` 호출 + 메시지-only warn 검증(W3 동시 검증).
- 총 7 테스트 통과(순수 함수 4 + 부트스트랩 3).

### W6 (Documentation) — stale 주석 현행화 [FIXED]
- `continuation-dlq-monitor.service.ts` 헤더 "OTel traces-only" → "traces + Prometheus 메트릭 파이프라인, custom 비즈니스 메트릭은 후속" 으로 갱신.

## Info 처리
- INFO 7: `DEFAULT_PROMETHEUS_PORT`/`resolvePrometheusPort` export 에 `@internal` JSDoc 추가.
- INFO 6/12: `.env.example` Observability 블록에 `OTEL_PROMETHEUS_PORT`/`OTEL_PROMETHEUS_HOST` + scrape job 안내 추가.
- INFO 1 (SPEC-DRIFT): `spec/data-flow/9-observability.md §4` 에 인프라 메트릭 파이프라인 cross-reference note 추가(authoritative SoT 는 `_product-overview.md` NF-OB-02).
- INFO 3 (특권 포트 <1024 차단): **미적용** — 운영자가 의도적으로 80/443 설정 시 silent 폴백으로 가리는 게 더 위험. 유효 포트 범위(1–65535) 유지.
- INFO 2 (`OTEL_METRICS_ENABLED` 독립 토글)·INFO 13(dependency NONE): 비차단/조치 불필요.

## 검증
- `jest instrumentation.spec.ts` 7/7 통과. `nest build` 0. eslint 0.

## ESCALATE
- 없음 (no). Critical 0, RISK LOW, 모든 Warning 해소.
