# Security Review

## 발견사항

### **[WARNING]** Prometheus `/metrics` 엔드포인트 인증 없음 — 정보 노출 위험
- **위치**: `codebase/backend/src/instrumentation.ts` line 50 (`new PrometheusExporter({ port: prometheusPort })`)
- **상세**: `PrometheusExporter`가 별도 HTTP 서버(기본 `:9464`)를 띄워 `/metrics`를 인증 없이 노출한다. Prometheus 메트릭에는 서비스명·호스트명·런타임 버전·event-loop 지연·GC 패턴·HTTP 경로 이름·DB 커넥션 풀 상태 등 정보가 포함될 수 있다. 이 데이터는 공격자에게 내부 구조 파악(정보 수집 단계)에 유용하며, OWASP A05:2021 Security Misconfiguration에 해당한다. `0.0.0.0`에 바인딩하면 컨테이너 네트워크 외부에서 접근 가능한 경우가 생길 수 있다.
- **제안**:
  1. 최소한 `PrometheusExporter` 를 loopback(`host: '127.0.0.1'`)에만 바인딩하도록 옵션을 명시한다(`new PrometheusExporter({ port: prometheusPort, host: '127.0.0.1' })`). 프로덕션 배포에서는 reverse proxy(Nginx 등)나 네트워크 ACL로 스크레이퍼 IP만 허용한다.
  2. 운영 가이드(셀프 호스팅 문서, 현재 NF-SC-08로 미구현)에 포트 9464 방화벽 정책을 명시한다.
  3. 운영 메트릭 노출을 외부에 허용해야 한다면 Bearer token이나 mutual TLS 인증을 적용한다.

### **[WARNING]** 에러 객체를 `console.warn`에 직접 전달 — 에러 상세 노출
- **위치**: `codebase/backend/src/instrumentation.ts` line 78 (`console.warn('[otel] failed to start tracing/metrics:', err)`)
- **상세**: `err` 객체를 그대로 콘솔에 출력하면 스택 트레이스·라이브러리 버전·내부 경로가 로그에 남는다. 구조화 로깅 파이프라인(NF-OB-01)에서 이 로그가 외부 수집기(Elasticsearch, 로그 뷰어)로 전달되면 외부 노출 가능성이 생긴다. 에러 객체가 자격증명이나 엔드포인트 URL을 포함하는 경우(예: OTLP endpoint 접속 실패 시 URL이 error message에 포함될 수 있음) 민감 정보 노출로 이어질 수 있다.
- **제안**: `err instanceof Error ? err.message : String(err)`와 같이 에러 메시지만 추출해 출력하거나, 로깅 레벨과 민감 필드 마스킹 정책이 적용된 구조화 로거를 사용한다.

### **[INFO]** `OTEL_ENABLED` 단일 토글로 traces + metrics 동시 제어
- **위치**: `codebase/backend/src/instrumentation.ts` line 43
- **상세**: `OTEL_ENABLED=true` 하나로 traces와 metrics가 함께 활성화된다. 보안 이슈는 아니나, 프로덕션에서 트레이싱은 비활성화하고 메트릭만 노출하거나 그 반대 경우를 지원하기 어려워 운영 유연성이 낮다. 현재 설계로는 메트릭 포트만 선택적으로 끌 수 없다.
- **제안**: 필요 시 `OTEL_METRICS_ENABLED` 같은 독립 환경 변수를 추가해 granular 제어가 가능하도록 개선을 고려한다. 현재 단계에서는 blocking 이슈 아님.

### **[INFO]** 의존성 `@opentelemetry/exporter-prometheus@^0.218.0` — 알려진 취약점 없음
- **위치**: `codebase/backend/package.json` / `package-lock.json`
- **상세**: `^0.218.0` 버전은 기존 OTel 0.218 스택과 정렬된다. 현재 시점(2026-06-14) 기준 이 버전에 공개된 CVE는 확인되지 않는다. `@opentelemetry` 패밀리는 CNCF 관리 프로젝트로 보안 패치가 활성적으로 유지된다.
- **제안**: 정기 `npm audit` 실행을 CI 파이프라인에 유지한다.

### **[INFO]** 포트 해석 함수 `resolvePrometheusPort` — 입력 검증 적절함
- **위치**: `codebase/backend/src/instrumentation.ts` lines 34–41
- **상세**: `undefined`, 빈 문자열, 비숫자, 범위 외(0, 음수, >65535), 부동소수점 등을 모두 기본값으로 폴백하며, 특권 포트(1–1023)는 막지 않는다. 1–1023 포트를 설정하면 Node.js 프로세스가 root 권한을 요구하므로 런타임에 실패하게 된다. 이는 DoS 위험이 아닌 운영 실수 영역이므로 INFO로 분류한다.
- **제안**: 필요 시 `parsed < 1024` 조건 추가로 특권 포트도 폴백 처리한다(`parsed < 1024 || parsed > 65535`).

## 요약

이번 변경은 기존 OpenTelemetry 스택에 `PrometheusExporter`를 추가하는 최소 범위의 관측성 인프라 확장이다. 인젝션, 하드코딩 시크릿, 인증/인가(메인 API), 암호화, 의존성 CVE 관점에서는 새로운 위험이 없다. 가장 주목할 보안 이슈는 Prometheus `/metrics` 엔드포인트가 바인딩 주소 제한이나 인증 없이 기동된다는 점으로, 내부 시스템 정보가 네트워크 접근 가능 범위에 노출될 수 있다. 컨테이너 오케스트레이션 환경에서 네트워크 정책으로 보호된다면 즉각적 위험도는 낮지만, `host: '127.0.0.1'` 바인딩 명시를 통해 defense-in-depth를 확보하는 것을 권장한다.

## 위험도

LOW
