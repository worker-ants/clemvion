# 부작용(Side Effect) 리뷰 결과

## 발견사항

### **[WARNING]** `PrometheusExporter` 생성이 HTTP 서버를 즉시 기동함 (포트 점유 부작용)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.ts` — `new PrometheusExporter({ port: prometheusPort })` (라인 이후 `if (enabled)` 블록 내부)
- 상세: `@opentelemetry/exporter-prometheus` 의 `PrometheusExporter` 는 인스턴스 생성 시점(생성자)에 내부 HTTP 서버를 즉시 bind/listen 한다. 이 서버는 `sdk.start()` 가 호출되기 전에 이미 포트를 점유하며, `sdk.start()` 실패(try/catch로 캡처됨) 시에도 HTTP 서버는 계속 살아있다. 결과적으로 `sdk.start()` 가 실패해도 :9464(또는 지정 포트)는 점유된 채로 남고 SIGTERM 핸들러에서 `sdk.shutdown()`을 호출해도 이 서버가 정리될 보장이 없다. `PrometheusExporter` 에는 독립적인 `stopServer()` 메서드가 있지만 현재 SIGTERM 핸들러는 `sdk.shutdown()`만 호출한다.
- 제안: `sdk.start()` 실패 시 `prometheusExporter.stopServer()` 를 catch 블록에서 호출하거나, 또는 SDK 가 성공적으로 시작된 후에만 exporter 를 유효 상태로 간주하도록 순서를 재정비한다.

### **[WARNING]** `process.on('SIGTERM', ...)` 핸들러가 누적 등록될 가능성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.ts` — `process.on('SIGTERM', ...)` (마지막 라인)
- 상세: `instrumentation.ts` 는 모듈 최초 import 시 top-level 코드로 실행된다. Node.js 환경에서 require/import 캐싱이 정상 작동하면 단 1회만 실행되나, 테스트 환경 또는 jest 의 module isolation(`jest.resetModules()`, `jest.isolateModules()`) 을 사용하면 모듈이 재실행되어 SIGTERM 핸들러가 중복 등록될 수 있다. `OTEL_ENABLED=true` 인 테스트 환경에서 해당 시나리오가 발생한다. 단, 현재 스펙(테스트는 `OTEL_ENABLED` 미설정)에 따라 테스트 실행 중에는 `if (enabled)` 블록이 진입하지 않으므로 실질적 위험은 낮다.
- 제안: 핸들러 등록 전 `process.listenerCount('SIGTERM') === 0` 가드를 추가하거나 `process.once('SIGTERM', ...)` 로 변경하는 것을 고려한다.

### **[INFO]** 새 환경 변수 `OTEL_PROMETHEUS_PORT` 도입
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.ts` — `process.env.OTEL_PROMETHEUS_PORT` 읽기
- 상세: 새로운 환경 변수가 추가되었다. 미설정 시 9464로 안전하게 폴백하므로 기존 배포에서 이 변수가 없어도 동작은 정상이다. 그러나 Docker Compose / Kubernetes 설정 및 배포 문서에 이 변수가 반영되어야 포트 충돌 없이 커스텀 포트 지정이 가능하다. 변수명이 비표준(`OTEL_` 프리픽스는 일부 OTel SDK 에서 자동으로 해석하는 예약 네임스페이스임)이나 `exporter-prometheus` 의 Node SDK 자체 환경 변수 우선순위 충돌은 없는 것으로 파악된다.
- 제안: 운영 가이드 / `.env.example` 에 `OTEL_PROMETHEUS_PORT=9464` 를 문서화한다.

### **[INFO]** 새 네트워크 서버 바인딩 — 포트 9464 HTTP 서버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.ts` — `new PrometheusExporter({ port: prometheusPort })`
- 상세: `OTEL_ENABLED=true` 로 설정된 모든 환경(개발·스테이징·운영)에서 애플리케이션 포트 외에 `:9464` HTTP 서버가 추가로 기동된다. 이는 의도된 동작이지만, 방화벽/보안그룹 규칙이 없다면 이 포트가 외부에 노출될 수 있다. Prometheus exporter 의 `/metrics` 엔드포인트에는 인증이 없으며 시스템 런타임 정보(heap, GC, event loop 지연)가 노출된다.
- 제안: 운영 배포 시 `:9464` 포트를 Prometheus 스크래퍼 IP 대역에만 허용하는 네트워크 정책을 문서화 또는 주석으로 권고한다.

### **[INFO]** `resolvePrometheusPort` 함수가 `export` 로 공개 API 등록
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/src/instrumentation.ts` — `export function resolvePrometheusPort` / `export const DEFAULT_PROMETHEUS_PORT`
- 상세: 순수 헬퍼 함수와 상수가 export 되었다. 테스트 목적상 설계된 결정이며 기존 API 시그니처에는 영향이 없다. `instrumentation.ts` 는 이미 공개 모듈이므로 이 export 들은 내부 소비로만 쓰이는 것이 명확하다. 칼럼 파괴적 변경 없음.
- 제안: 의도가 테스트용 export 임을 주석(`/** @internal */` 또는 `/** @testonly */`)으로 명시하면 후속 개발자의 오용을 방지할 수 있다.

### **[INFO]** `package.json` / `package-lock.json` 에 새 직접 의존성 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/impl-system-metrics-prometheus-23c34e/codebase/backend/package.json` — `@opentelemetry/exporter-prometheus@^0.218.0`
- 상세: 기존 OTel 0.218 스택과 동일한 버전 라인이므로 호환성 문제는 없다. `sdk-metrics` 와 관련 패키지는 `sdk-node` / `auto-instrumentations-node` 의 transitive 의존성으로 이미 존재한다. 의존성 트리 변화에 따른 예상치 못한 peer 충돌은 없는 것으로 판단된다.
- 제안: 없음.

---

## 요약

이번 변경은 `OTEL_ENABLED=true` 게이트 뒤에서만 동작하므로 기본 배포에서는 부작용이 전혀 없다. 핵심 위험은 두 가지다. 첫째, `PrometheusExporter` 가 생성자 시점에 HTTP 서버를 즉시 기동하기 때문에 `sdk.start()` 실패 경로에서 exporter HTTP 서버가 미정리 상태로 남을 수 있다(WARNING). 둘째, SIGTERM 핸들러가 `process.on` 으로 등록되어 있어 모듈이 재실행되는 테스트 시나리오에서 중복 등록 가능성이 있으나 현재 테스트 환경은 `OTEL_ENABLED` 미설정이므로 실질적 위험은 낮다(WARNING). 그 외 신규 `:9464` 포트 노출, 신규 환경 변수, 테스트용 export 공개는 의도된 설계이며 기존 공개 API · 파일시스템 · 전역 상태에 의도치 않은 변경은 없다.

---

## 위험도

LOW
