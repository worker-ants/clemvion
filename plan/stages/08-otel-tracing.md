# Stage 8 · OpenTelemetry 트레이싱

## 배경

`NF-OB-03` — 분산 트레이싱. 백엔드 전반에 OpenTelemetry SDK 연동.

## 설계

### 범위

- HTTP 요청 → 서비스 레이어 → DB 쿼리까지 자동 계측(`@opentelemetry/instrumentation-http`, `-express`, `-pg`)
- 수동 스팬: 워크플로우 실행 한 건(`execution.run`), 각 노드 실행(`node.<type>.run`)
- Exporter: OTLP gRPC/HTTP — 환경 변수로 설정(`OTEL_EXPORTER_OTLP_ENDPOINT`)
- Collector: 문서 예시로 Jaeger / Tempo 연동 가이드

### 영향받는 파일

- 신규: `backend/src/instrumentation.ts` (Node.js preload)
- 수정: `backend/main.ts` — tracer 초기화 가장 먼저
- 수정: `backend/src/modules/execution-engine/**` — 실행·노드 스팬
- 수정: `docker-compose.yml` 예시 (Collector 주석)
- 수정: PRD `NF-OB-03` → ✅
- 수정: 셀프 호스팅 운영 문서 (없다면 신규)

### 테스트

- e2e에서 trace header 전파 확인
- 로컬 Jaeger 연동 smoke test

### 검증

- 워크플로우 실행 후 Jaeger UI에서 execution 스팬 트리 확인
