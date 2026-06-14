# 의존성(Dependency) 리뷰

## 발견사항

### [INFO] 새 의존성: `@opentelemetry/exporter-prometheus@^0.218.0`
- 위치: `codebase/backend/package.json` L44, `codebase/backend/package-lock.json` L35
- 상세: NF-OB-02 (Prometheus 호환 메트릭) 요구사항 충족을 위해 단일 패키지를 직접 의존성으로 추가. `prom-client` 를 별도로 추가하지 않고 OTel 생태계 안에서 처리한 점은 올바른 접근이다.
- 제안: 현상 유지 — 필요성 충분.

### [INFO] 버전 고정: caret 범위(`^0.218.0`) 사용
- 위치: `codebase/backend/package.json` L44
- 상세: 기존 OTel 패키지들(`@opentelemetry/exporter-trace-otlp-http`, `@opentelemetry/sdk-node`)이 모두 `^0.218.0` caret 범위로 선언되어 있으며, 이번 추가도 동일 패턴을 따른다. 단, `0.x.y` 시맨틱에서 caret은 마이너 업데이트만 허용하므로 breaking change 위험은 제한적이다. lock 파일에 `0.218.0` 으로 정확히 고정되어 일관성이 있다.
- 제안: 기존 OTel 스택 버전 전략과 동일하므로 허용 가능. 전체 OTel 스택을 동시에 업그레이드하는 정책이 있다면 그 시점에 함께 올리는 것으로 충분.

### [INFO] 라이선스: Apache-2.0
- 위치: `package-lock.json` — `node_modules/@opentelemetry/exporter-prometheus` 항목
- 상세: `"license": "Apache-2.0"`. 프로젝트 루트 라이선스가 `UNLICENSED`(사내 전용)이고, 기존 OTel 패키지들도 동일하게 Apache-2.0을 사용한다. 사내 서버 측 사용이므로 배포·공개 의무 없음.
- 제안: 문제 없음.

### [INFO] 취약점 점검
- 위치: `@opentelemetry/exporter-prometheus@0.218.0`
- 상세: 해당 버전에 대해 알려진 CVE가 없다. 이 패키지는 오직 metrics scrape 서버를 노출하는 역할이며, 외부 입력을 직접 파싱하지 않는다. 단, PrometheusExporter 가 기동하는 scrape 서버(:9464)는 인증 없이 접근 가능하므로 인프라 수준의 네트워크 격리(Prometheus 서버만 접근 가능하도록)가 별도 확인되어야 한다.
- 제안: 네트워크 정책으로 `:9464` 포트를 내부 스크레이프 전용으로 제한. 코드 자체의 취약점 위험은 낮음.

### [INFO] 불필요한 의존성 여부
- 위치: `codebase/backend/src/instrumentation.ts`
- 상세: `@opentelemetry/sdk-metrics` 는 `@opentelemetry/sdk-node` 및 `@opentelemetry/auto-instrumentations-node` 의 transitive 의존성으로 이미 lock 파일에 존재했다. `@opentelemetry/exporter-prometheus` 의 직접 의존성 추가는 `PrometheusExporter` 클래스를 명시적으로 사용하기 위해 불가피하다. `prom-client`를 별도 추가하지 않은 점도 올바르다 — exporter-prometheus 가 내부적으로 포함하고 있다.
- 제안: 현상 유지.

### [INFO] 의존성 크기 및 번들 영향
- 위치: `@opentelemetry/exporter-prometheus@0.218.0` 및 transitive
- 상세: 이 패키지는 `@opentelemetry/core`, `@opentelemetry/resources`, `@opentelemetry/sdk-metrics`, `@opentelemetry/semantic-conventions` 를 직접 의존성으로 가지며, 이들은 모두 기존 OTel 스택 덕분에 이미 설치되어 있다(lock 파일 내 동일 버전 확인). 따라서 실질적으로 새로 설치되는 코드는 `exporter-prometheus` 본체만이다. 서버 측 Node.js 런타임이므로 번들 크기는 문제가 없다.
- 제안: 영향 없음.

### [INFO] 기존 의존성과의 버전 호환성
- 위치: `package-lock.json` — OTel 관련 패키지들
- 상세: 새 패키지의 peer dependency는 `@opentelemetry/api: ^1.3.0`. 현재 프로젝트는 `@opentelemetry/api@^1.9.0`(lock: 1.9.x)을 사용하므로 완전히 충족된다. `exporter-prometheus@0.218.0` 의 transitive 의존성인 `@opentelemetry/core@2.7.1`, `@opentelemetry/resources@2.7.1`, `@opentelemetry/sdk-metrics@2.7.1` 은 기존 스택(`sdk-node@0.218.0`)이 이미 요구하는 버전과 동일하여 충돌이 없다.
- 제안: 호환성 문제 없음.

### [INFO] 내부 의존성: `instrumentation.ts` 단일 파일에서만 사용
- 위치: `codebase/backend/src/instrumentation.ts`
- 상세: `PrometheusExporter` 는 `instrumentation.ts` 에서만 import되며, NestJS 애플리케이션 컨텍스트 외부의 부트스트랩 단계에서 초기화된다. `main.ts` 이전에 로드되는 구조로, 내부 모듈 간 순환 의존성 위험이 없다.
- 제안: 구조 적절.

---

## 요약

이번 변경의 의존성 관점 위험은 사실상 없다. `@opentelemetry/exporter-prometheus@^0.218.0` 은 기존 OTel 0.218 스택과 버전 라인이 일치하고, transitive 의존성 대부분이 이미 lock 파일에 존재하며, 라이선스(Apache-2.0)와 peer dependency 요건이 모두 충족된다. 버전 선언 방식도 기존 OTel 패키지들과 동일한 caret 범위를 사용해 일관성이 있다. 운영 측면에서 PrometheusExporter 가 인증 없이 `:9464` 포트를 노출하므로 인프라 레벨의 네트워크 접근 제어가 권장되지만, 이는 코드 의존성 자체의 문제가 아닌 배포 설정 사항이다.

## 위험도

NONE
