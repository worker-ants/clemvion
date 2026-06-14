# 문서화(Documentation) Review

## 발견사항

### 발견사항 1
- **[INFO]** `business-metrics.service.ts` — `LlmTokenUsage` 인터페이스가 `private`(파일 내부)으로만 선언되어 있으며, 외부 호출부(`LlmUsageLogService`)가 `TokenUsage` 타입을 전달한다. 두 타입의 관계(structural compatibility)가 코드 주석·JSDoc 어디에도 명시되어 있지 않아 추후 필드 추가 시 조용한 미스매치 가능성이 있다.
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` 파일 내 `LlmTokenUsage` 인터페이스 선언부
  - 상세: `LlmTokenUsage`는 internal interface이지만, 이를 받는 `recordLlmTokens` 메서드는 공개(public) API다. 인터페이스를 export하거나, JSDoc에 "accepts `TokenUsage` compatible shape"이라는 설명을 추가하면 호출부 작성자에게 의도가 명확해진다.
  - 제안: `LlmTokenUsage`를 export하거나, `recordLlmTokens` JSDoc에 `@param usage` 설명에 수용 가능한 필드와 optional 여부를 명시한다.

### 발견사항 2
- **[INFO]** `execution-engine.service.spec.ts` — line 15290 인근 `BusinessMetricsService` 가 providers 배열에 두 번 등록되어 있다 (`BusinessMetricsService, BusinessMetricsService`).
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` diff 섹션 `SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트` describe 블록
  - 상세: NestJS `TestingModule`에서 동일 provider를 중복 등록하면 마지막 항목이 덮어쓰므로 기능 영향은 없지만, 코드 리뷰 혼란을 유발한다. 테스트 파일 내 주석도 없어 의도인지 실수인지 판단이 불가하다.
  - 제안: 중복된 `BusinessMetricsService` 한 줄을 제거하거나, 의도적 배치인 경우 이유를 인라인 주석으로 남긴다.

### 발견사항 3
- **[INFO]** `continuation-dlq-monitor.service.ts` — `onModuleInit` 내 `registerQueueDepthProvider` 콜백이 `enabled` 플래그와 무관하게 항상 등록된다는 설계 의도가 인라인 주석으로 잘 설명되어 있다. 그러나 `checkOnce`의 JSDoc에는 이 변화(큐 깊이가 gauge로도 노출됨)가 반영되어 있지 않아 `checkOnce` 만 보는 독자가 gauge 계측 역할을 놓칠 수 있다.
  - 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` `checkOnce` JSDoc
  - 상세: `checkOnce` JSDoc은 "큐 depth 1회 점검"이라고만 기술하며, gauge provider 등록과의 관계가 명시되지 않는다. `onModuleInit`에서 gauge를 등록하고 `checkOnce`는 alarm-only임을 한 줄 언급하면 역할 분리가 명확해진다.
  - 제안: `checkOnce` JSDoc에 "큐 깊이 관측은 `onModuleInit`에서 등록된 gauge provider가 별도로 담당한다"는 한 줄을 추가한다.

### 발견사항 4
- **[INFO]** `execution-engine.service.ts` — `recordNodeLatencyMetrics` private 메서드는 JSDoc이 있으나, `emitTerminalExecutionMetrics`와의 호출 관계(fire-and-forget)만 언급할 뿐 "언제 node_execution에 `durationMs`가 채워지는지"를 명시하지 않는다. 이 필드가 채워지지 않으면 `durationMs == null` 체크로 건너뛰는 방어 로직이 있는데, 이 방어의 전제 조건이 주석에 설명되어 있지 않다.
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `recordNodeLatencyMetrics` 메서드 JSDoc 및 `durationMs == null` 체크 인라인
  - 상세: `durationMs`가 언제 null이 될 수 있는지(예: 아직 완료되지 않은 노드, 레거시 데이터) 설명이 없으면 향후 유지보수자가 방어 코드를 제거하는 실수를 할 수 있다.
  - 제안: `// durationMs 는 NodeExecution 완료 시점에 엔진이 채운다. 미완료·레거시 row 는 null 일 수 있어 건너뜀` 형태의 인라인 주석을 `durationMs == null` 체크 옆에 추가한다.

### 발견사항 5
- **[INFO]** `spec/5-system/_product-overview.md` — NF-OB-07 메트릭 카탈로그에 `clemvion.node.duration` histogram의 bucket 설정이 명시되어 있지 않다. 현재 구현은 OTel 기본 bucket을 사용하는데, 노드 지연 특성상 ms 단위 fine-grained bucket이 필요할 수 있다. spec 문서에 "기본 bucket 사용" 또는 권장 bucket 범위를 명기하면 미래 설정 시 의사결정 근거가 남는다.
  - 위치: `/spec/5-system/_product-overview.md` NF-OB-07 메트릭 카탈로그 표 내 `clemvion.node.duration` 행
  - 상세: bucket 미명시는 기능 오류는 아니나, 운영팀이 Grafana에서 p95/p99 분포를 확인할 때 기본 bucket이 적절한지 판단 근거가 없다.
  - 제안: 카탈로그 표 하단 또는 해당 행 의미 칼럼에 "(기본 OTel bucket 사용; 필요 시 `ExplicitBucketHistogramAggregation` 으로 재구성 가능)" 정도의 주석을 추가한다.

### 발견사항 6
- **[INFO]** 새로 도입된 환경변수 `OTEL_PROMETHEUS_HOST`가 `spec/5-system/_product-overview.md` NF-OB-02 행에 추가되었으나, 실제 `.env` 예시·README·운영 가이드에 이 변수가 추가되어야 하는지에 대한 언급이 변경 파일들 어디에도 없다. 본 PR 범위 내에 설정 문서(`.env.example` 등) 파일이 포함되어 있지 않다.
  - 위치: `/spec/5-system/_product-overview.md` NF-OB-02 행 (`OTEL_PROMETHEUS_HOST` 신규 언급)
  - 상세: `OTEL_PROMETHEUS_HOST`가 기본값 `127.0.0.1`을 가진다고 spec에 기술되어 있지만, 운영자가 참조하는 `.env.example` 또는 설치 가이드에 반영 여부가 불명확하다.
  - 제안: `.env.example`(또는 프로젝트 내 환경변수 목록 파일)에 `OTEL_PROMETHEUS_HOST=127.0.0.1` 항목 추가가 필요한지 확인하고, 필요 시 후속 작업으로 등록한다.

### 발견사항 7
- **[INFO]** `metrics.module.ts` — 모듈 수준 JSDoc은 `@Global` 선택 이유와 계측 지점(execution-engine·llm·continuation)을 설명한다. 그러나 "왜 별도 모듈이 필요한가"(기존 모듈에 service를 추가하지 않고 분리한 이유)에 대한 Rationale이 없다. `RedisModule`이 `(ai-review INFO-12)`처럼 리뷰 참조를 인라인으로 남기는 패턴과 일치하지 않는다.
  - 위치: `/codebase/backend/src/modules/metrics/metrics.module.ts` JSDoc
  - 상세: 현재 주석은 "무엇을 하는지"는 설명하지만, 분리 선택 근거(계측 지점이 여러 모듈에 분산되므로 @Global 단일 모듈이 효율적)가 짧게나마 있으면 유지보수 시 모듈 통합/분리 의사결정이 쉬워진다.
  - 제안: JSDoc에 "(여러 feature 모듈이 계측하므로 @Global 분리 — 각 모듈이 MetricsModule을 재import하지 않아도 됨)" 형태의 설명을 추가한다.

## 요약

전반적으로 이 PR은 문서화 품질이 우수하다. `BusinessMetricsService`의 클래스 JSDoc은 no-op 동작, 이원화 정책, spec 참조를 모두 포함하고, `continuation-dlq-monitor.service.ts`의 docstring도 역할 분리(gauge vs. alarm)를 명확히 설명하도록 업데이트되었으며, `spec/5-system/_product-overview.md`에 NF-OB-07 메트릭 카탈로그 표가 신설되어 메트릭 이름·라벨·의미가 단일 진실로 정립되었다. 발견된 항목은 모두 INFO 수준이며 중복 provider 등록(테스트 파일의 `BusinessMetricsService` 두 번 등록)처럼 코드 명확성 개선 수준이다. `OTEL_PROMETHEUS_HOST` 환경변수의 `.env.example` 반영 여부만 후속 확인이 필요하다.

## 위험도

LOW

---

STATUS: SUCCESS
