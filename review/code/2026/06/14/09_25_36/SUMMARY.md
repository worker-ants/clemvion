# Code Review 통합 보고서 — impl-system-metrics-prometheus (NF-OB-02)

## 전체 위험도
**LOW** — Prometheus 메트릭 파이프라인 최소 구현은 안전·범위 적절. `/metrics` 인증 부재·`sdk.start()` 실패 시 exporter 서버 미정리·부트스트랩 경로 테스트 공백이 낮은 위험으로 남음.

- **Critical**: 0 · **Warning**: 6 · **Info**: 13

## Critical
없음.

## 경고 (WARNING) — 처리

| # | 카테고리 | 발견 | 처리 |
|---|----------|------|------|
| 1 | Security | `/metrics` 가 인증 없이 `0.0.0.0` 바인딩 — 내부 정보 노출 | **수정** — `OTEL_PROMETHEUS_HOST`(기본 `127.0.0.1`) 추가, secure-by-default loopback 바인딩. 컨테이너 scrape 는 env 로 override |
| 2 | Security | `console.warn(..., err)` 가 에러 객체 직접 출력(스택/경로 노출) | **수정** — `err instanceof Error ? err.message : String(err)` 로 메시지만 |
| 3 | Side-Effect | `PrometheusExporter` 가 즉시 listen — `sdk.start()` 실패 시 서버 잔류(포트 누수) | **수정** — catch 에서 `prometheusExporter.stopServer()` 호출 |
| 4 | Side-Effect | `process.on('SIGTERM')` 모듈 재실행 시 중복 등록 | **수정** — `process.once('SIGTERM', ...)` |
| 5 | Testing | `OTEL_ENABLED=true` 부트스트랩 분기 미커버 | **수정** — OTel 모듈 mock + `jest.isolateModules` 부트스트랩 테스트 추가 |
| 6 | Documentation | `continuation-dlq-monitor.service.ts:30` "traces-only" stale 주석 | **수정** — "traces + metrics" 로 현행화 |

## 참고 (INFO) — 처리 요약
- INFO 7 (`@internal` JSDoc on exports): **추가**.
- INFO 6/12 (`OTEL_PROMETHEUS_PORT`/`_HOST` 문서화): `.env.example` 에 **추가**(존재 시).
- INFO 1 (SPEC-DRIFT `data-flow/9-observability.md` 메트릭 절): 메트릭 파이프라인 한 절 **doc-sync 추가**(구현 사실 반영).
- INFO 3 (특권 포트 <1024 차단): 의도적 설정(컨테이너 root 80/443) 을 silent 폴백으로 가리지 않도록 **현행 유지**(1–65535).
- INFO 2 (`OTEL_METRICS_ENABLED` 독립 토글): 현 단계 비차단 — 후속.
- INFO 13 (dependency): `@opentelemetry/exporter-prometheus@^0.218.0` — CVE 없음·Apache-2.0·peer 충족·신규 transitive 유입 없음. 조치 불필요.

## 에이전트별 위험도
security LOW · requirement LOW · scope NONE · side_effect LOW · maintainability NONE · testing LOW · documentation LOW · dependency NONE

## 결론
Critical 0, RISK LOW. 6개 Warning 전부 본 PR 에서 수정(보안 2·부작용 2·테스트 1·문서 1). dependency NONE(신규 패키지 유입 없음). **BLOCK 없음 — 머지 가능.**
