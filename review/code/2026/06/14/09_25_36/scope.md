# 변경 범위(Scope) Review

## 리뷰 대상

작업 의도: NF-OB-02 Prometheus 메트릭 파이프라인 최소 구현 — 기존 OTel 스택에 `@opentelemetry/exporter-prometheus` 를 추가하고 NodeSDK MeterProvider 에 연결.

변경 파일 (6건):
1. `codebase/backend/package-lock.json`
2. `codebase/backend/package.json`
3. `codebase/backend/src/instrumentation.spec.ts` (신규)
4. `codebase/backend/src/instrumentation.ts`
5. `plan/in-progress/spec-sync-5-system-metrics-gap.md`
6. `spec/5-system/_product-overview.md`

---

## 발견사항

발견된 범위 이탈 항목 없음.

각 파일별 점검 결과:

**파일 1 & 2 — package.json / package-lock.json**
- `@opentelemetry/exporter-prometheus@^0.218.0` 단일 의존성 추가. 기존 OTel 0.218 스택과 동일 버전 라인이며 작업 의도와 정확히 일치.
- 다른 의존성 추가·삭제·버전 변경 없음. lock 파일 변경도 신규 패키지 체인에 국한.
- 불필요한 `devDependencies` 추가나 정리 없음.

**파일 3 — instrumentation.spec.ts (신규)**
- `resolvePrometheusPort` 헬퍼 함수만 독립 검증. 부트스트랩 부수효과(SDK 시작·HTTP 서버 기동) 테스트를 명시적으로 배제한 설계는 적절하고 범위 초과가 아님.
- 테스트 케이스 4개 모두 포트 해석 폴백 로직에 집중. 다른 기능 테스트 추가 없음.
- 신규 파일이므로 포맷팅/주석 이슈 해당 없음.

**파일 4 — instrumentation.ts**
- 변경 내용: `PrometheusExporter` import, `DEFAULT_PROMETHEUS_PORT` 상수, `resolvePrometheusPort` 헬퍼 추가, `metricReaders` NodeSDK 연결, `console.log/warn` 메시지 업데이트, 파일 상단 JSDoc 업데이트.
- `console.log` / `console.warn` 문자열 변경은 tracing → tracing/metrics 로 실제 의미가 바뀐 것이므로 포맷팅 변경이 아닌 기능적 업데이트. 범위 내.
- JSDoc 주석 변경(환경 변수 목록 `OTEL_PROMETHEUS_PORT` 추가, Collector 예시 업데이트)은 신규 기능 문서화이므로 적절.
- 기존 tracing 코드(`OTLPTraceExporter`, `getNodeAutoInstrumentations`, SIGTERM 핸들러 등) 무수정. 관련 없는 리팩토링 없음.

**파일 5 — plan/in-progress/spec-sync-5-system-metrics-gap.md**
- 미구현 체크박스를 완료로 전환하고, 구현 요약 및 후속 항목을 문서화. Plan lifecycle 규칙에 따른 정상 업데이트.
- 후속 항목(`비즈니스 커스텀 메트릭`, `continuation-dlq-monitor 주석 현행화`)을 "본 PR 범위 밖"으로 명시 분리. 범위 경계를 올바르게 설정.

**파일 6 — spec/5-system/_product-overview.md**
- NF-OB-02 상태 셀 1개만 변경(`❌ 미구현` → `✅ 구현 완료 설명`). 다른 행 수정 없음.
- 변경 범위가 단일 표 행에 국한되어 있어 무관한 spec 수정 없음.

---

## 요약

6개 변경 파일 모두 "NF-OB-02 Prometheus 메트릭 파이프라인 최소 구현"이라는 단일 목적에 집중되어 있다. 의존성 1개 추가, 기존 `instrumentation.ts` 에 PrometheusExporter 연결, 포트 해석 헬퍼 단위 테스트, Plan/Spec 상태 반영의 4개 레이어가 작업 의도와 정확히 대응한다. 관련 없는 리팩토링·기능 확장·포맷팅 노이즈·무관한 파일 수정은 발견되지 않았다. 비즈니스 커스텀 메트릭 등 후속 항목은 명시적으로 별도 PR로 분리되어 over-engineering 리스크도 없다.

## 위험도

NONE
