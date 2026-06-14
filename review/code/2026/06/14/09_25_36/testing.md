### 발견사항

- **[INFO]** `resolvePrometheusPort` 단위 테스트 존재 — 범위 적절
  - 위치: `/codebase/backend/src/instrumentation.spec.ts`
  - 상세: 새로 추출된 `resolvePrometheusPort` 함수에 대해 undefined, 빈 문자열, 공백, 유효 포트, 비숫자, 범위 초과, 소수점 케이스를 모두 커버하고 있다. `DEFAULT_PROMETHEUS_PORT` 상수값(9464)도 직접 단언해 명세 역할을 겸한다.
  - 제안: 현재 커버리지로 충분함.

- **[WARNING]** 부트스트랩 경로(`OTEL_ENABLED=true` 분기)에 대한 테스트 부재
  - 위치: `instrumentation.ts` — `if (enabled) { ... }` 블록 전체 (PrometheusExporter 생성·NodeSDK 구성·sdk.start()·SIGTERM 핸들러)
  - 상세: 스펙 파일(`instrumentation.spec.ts`)의 주석이 명시적으로 "부트스트랩 부수효과는 테스트 환경에서 미설정이라 import만으로 서버가 뜨지 않는다"라고 설계 의도를 기술하고 있다. 따라서 현재 테스트는 `OTEL_ENABLED=true` 가드 안쪽의 코드 경로를 전혀 실행하지 않는다. 특히 다음 경로가 커버되지 않는다:
    1. `PrometheusExporter` 생성에 포트가 올바르게 전달되는지
    2. `NodeSDK`에 `metricReaders`가 주입되는지
    3. `sdk.start()` 실패 시 `console.warn` 경로
    4. SIGTERM 시 `sdk.shutdown()` 호출
  - 제안: `PrometheusExporter`와 `NodeSDK`를 mock하고 `OTEL_ENABLED=true`로 환경 변수를 설정한 뒤 모듈을 동적으로 재임포트(`jest.resetModules()` + `await import(...)`)하는 테스트를 추가하면 부트스트랩 경로를 검증할 수 있다. 단, 이 방식은 설정 복잡도가 높으므로 팀 정책상 "부수효과 모듈은 단위 테스트에서 제외" 결정이 있었다면 해당 주석에 명시해 두는 것이 좋다.

- **[INFO]** `process.env.OTEL_PROMETHEUS_PORT` → `resolvePrometheusPort` 연결 경로 테스트 없음
  - 위치: `instrumentation.ts` L5 (`const prometheusPort = resolvePrometheusPort(process.env.OTEL_PROMETHEUS_PORT)`)
  - 상세: 실제 환경 변수를 읽어 `resolvePrometheusPort`에 전달하는 연결 코드 자체는 부트스트랩 블록 안에 있어 테스트되지 않는다. `resolvePrometheusPort` 자체는 충분히 테스트되어 있으므로 실질적 위험은 낮지만, integration 관점에서는 공백이다.
  - 제안: 단위 테스트 한계 내에서는 현재 수준으로 수용 가능. 통합 환경(Prometheus scrape 성공 여부)은 e2e/smoke 테스트 범주이므로 별도 후속 작업으로 남기는 것이 타당하다.

- **[INFO]** 테스트 격리 양호
  - 위치: `instrumentation.spec.ts` 전체
  - 상세: 테스트가 `process.env`를 변경하지 않으며, 모듈 수준 부수효과(서버 기동)가 비활성 상태이므로 각 `it()` 간 상태 공유가 없다. 테스트 순서에 무관하게 독립 실행 가능하다.
  - 제안: 없음.

- **[INFO]** 테스트 가독성 양호
  - 위치: `instrumentation.spec.ts`
  - 상세: `describe` 블록이 스펙 ID(`NF-OB-02`)를 포함하고, 각 `it()` 설명이 입력 카테고리별로 명확하게 구분되어 있다. 스펙 파일 상단 주석이 설계 의도와 제약을 충분히 기술하고 있다.
  - 제안: 없음.

- **[INFO]** `console.warn`·`console.log` 호출에 대한 검증 없음
  - 위치: `instrumentation.ts` L30, L33
  - 상세: `sdk.start()` 성공/실패 시 콘솔 출력이 발생하나 현재 어떤 테스트도 이를 spy하지 않는다. 운영 환경에서 로그 형식(`[otel] tracing + metrics enabled (Prometheus :${prometheusPort}/metrics)`)이 변경되더라도 회귀가 감지되지 않는다.
  - 제안: 부트스트랩 경로 테스트를 추가할 경우 `jest.spyOn(console, 'log')`으로 메시지 형식도 함께 검증하는 것이 좋다. 현재 테스트 범위에서는 낮은 우선순위.

---

### 요약

이번 변경의 핵심 신규 로직인 `resolvePrometheusPort`는 경계값(undefined, 빈 문자열, 공백, 최소값 1, 최대값 65535, 소수, 비숫자, 음수, 범위 초과)을 모두 포함한 단위 테스트로 잘 커버되어 있다. 설계 의도 역시 주석으로 명확히 문서화되어 있다. 다만 `OTEL_ENABLED=true` 활성 분기(PrometheusExporter 생성·NodeSDK metricReaders 연결·start/shutdown 흐름)는 현행 테스트에서 전혀 실행되지 않는다. 이 부분은 모듈 재임포트 패턴과 mock을 활용해 보완 가능하나, 복잡도 대비 효용을 고려할 때 단기적으로는 수용 가능한 수준이다. 전체적으로 분리·가독성·격리 측면은 양호하며 회귀 위험은 낮다.

### 위험도

LOW
