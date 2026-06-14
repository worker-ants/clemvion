# 의존성(Dependency) 리뷰 결과

## 발견사항

### 새 의존성

- **[INFO]** 신규 외부 패키지 없음 — `@opentelemetry/api`는 `package.json`에 이미 `^1.9.0`으로 존재하는 기존 의존성이다.
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` import 절
  - 상세: `BusinessMetricsService`가 `@opentelemetry/api`의 `metrics.getMeter`·`Counter`·`Histogram`·`ObservableGauge`·`ObservableResult`를 사용하지만 이는 기존 스택에서 이미 포함된 패키지이므로 신규 설치 비용 없음.
  - 제안: 현행 유지.

### 버전 고정

- **[INFO]** `@opentelemetry/api`는 `^1.9.0`으로 caret 범위 지정이다.
  - 위치: `codebase/backend/package.json:45`
  - 상세: 이미 기존 PR(NF-OB-02)부터 채택된 버전 정책이며 본 PR 변경 범위가 아님. OTel API는 1.x 내 하위 호환 보장이 강하므로 caret은 통상 허용 수준이다.
  - 제안: 현행 정책 유지.

### 라이선스

- **[INFO]** `@opentelemetry/api`는 Apache-2.0 라이선스이며 프로젝트와 호환된다.

### 취약점

- **[INFO]** 새로 추가된 외부 패키지가 없으므로 신규 취약점 면(attack surface)이 없다.

### 불필요한 의존성 / 대체 가능성

- **[INFO]** `BusinessMetricsService`는 OTel API의 no-op meter 폴백에 의존해 `OTEL_ENABLED` 미설정 시 모든 instrument 호출이 무동작으로 안전하다. 별도의 조건부 guard 없이 동일 효과를 얻으므로 추가 의존성 없이 설계가 간결하다.

### 의존성 크기 / 빌드 영향

- **[INFO]** 신규 npm 패키지 설치가 없으므로 번들 크기·빌드 시간에 추가 영향 없음.

### 호환성

- **[INFO]** `@opentelemetry/api ^1.9.0` ↔ `@opentelemetry/sdk-node ^0.218.0` · `@opentelemetry/exporter-prometheus ^0.218.0` 조합은 기존 OTel 스택과 동일 라인이며 `BusinessMetricsService`가 추가로 API 계층만 사용하므로 버전 충돌 위험 없음.

### 내부 의존성

- **[INFO]** `MetricsModule`은 `@Global()`로 선언돼 `AppModule`에 한 번만 등록되며 계측 지점(execution-engine, llm, continuation-dlq-monitor)이 추가 module import 없이 `BusinessMetricsService`를 주입받는다.
  - 위치: `codebase/backend/src/modules/metrics/metrics.module.ts`·`codebase/backend/src/app.module.ts`
  - 상세: `@Global` 패턴은 프로젝트 내 `RedisModule`과 동일한 선례 적용이므로 아키텍처 일관성 있음.

- **[WARNING]** `execution-engine.service.spec.ts`의 `SUMMARY W3/W5/W6/W7` describe 블록에서 `BusinessMetricsService`가 두 번 중복 등록돼 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L15290-15292 (diff 기준)
  - 상세:
    ```
    BusinessMetricsService,
    BusinessMetricsService,
    ```
    NestJS `Test.createTestingModule`은 동일 provider 중복 등록을 자동 병합하므로 런타임 오류는 발생하지 않지만 명백한 복붙 오류이며 코드 리뷰 혼란 유발.
  - 제안: 두 줄 중 하나를 삭제한다.

- **[INFO]** `ContinuationDlqMonitorService`에 `BusinessMetricsService` 주입이 추가되면서 continuation 모듈이 metrics 모듈에 새로운 의존을 갖게 됐다.
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts`
  - 상세: `MetricsModule`이 `@Global`이므로 `ExecutionEngineModule`·continuation 모듈이 `MetricsModule`을 명시적으로 import하지 않아도 주입이 작동한다. 단방향 의존(metrics ← execution-engine ← continuation)이며 순환 의존 없음.
  - 제안: 현행 유지.

---

## 요약

본 변경은 신규 npm 패키지를 추가하지 않고 기존 `@opentelemetry/api` 의존성만을 활용해 `BusinessMetricsService`(`MetricsModule`)를 신설한다. `@Global` 모듈 패턴으로 계측 지점(execution-engine, llm, continuation-dlq-monitor)에 주입되는 내부 의존 구조는 프로젝트 기존 선례와 일치하고 순환 의존이 없다. 라이선스·버전 충돌·보안 취약점 측면의 위험은 없다. 단, `execution-engine.service.spec.ts` 내 `BusinessMetricsService` 중복 등록은 실제 동작에는 영향을 주지 않으나 명백한 복붙 오류이므로 수정이 권장된다.

## 위험도

LOW
