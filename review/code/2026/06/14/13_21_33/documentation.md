# 문서화(Documentation) Review

## 발견사항

### 발견사항 1
- **[INFO]** `business-metrics.service.ts` — `LlmTokenUsage` 인터페이스가 내부(`private`) 선언이지만 이를 받는 `recordLlmTokens` 메서드는 공개 API다. 두 타입(`LlmTokenUsage` vs `TokenUsage`)의 구조적 호환성이 JSDoc에 명시되어 있지 않다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.ts` L25-29, L96
  - 상세: `recordLlmTokens(model: string, usage: LlmTokenUsage)` 공개 메서드가 파일 외부로 export되지 않은 `LlmTokenUsage` 인터페이스를 파라미터 타입으로 사용한다. `LlmUsageLogService`에서 `TokenUsage` 타입의 값을 전달하는데, 두 타입이 구조적으로 호환됨을 주석 어디에도 설명하지 않는다. 향후 `TokenUsage`에 필드가 추가될 때 `LlmTokenUsage`가 조용히 누락될 수 있다. 메서드 JSDoc(`/** LLM 호출의 토큰 사용량을 type 별로 누적... */`)도 파라미터 타입 설명이 없다.
  - 제안: `recordLlmTokens` JSDoc에 `@param usage` 설명과 함께 "구조는 `TokenUsage` 호환(metrics 모듈이 llm 모듈에 의존하지 않도록 로컬 interface 별도 정의)" 한 줄을 추가한다. 또는 `LlmTokenUsage`를 export해 호출부가 타입을 명시적으로 참조할 수 있게 한다. 이 항목은 이전 리뷰(12_32_02/documentation.md 발견사항 1, INFO #9)에서도 지적됐으나 후속 처리로 분류된 상태다.

### 발견사항 2
- **[INFO]** `continuation-dlq-monitor.service.ts` — `checkOnce` JSDoc이 gauge provider 등록과의 역할 분리를 언급하지 않는다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` L102-115 (`checkOnce` JSDoc)
  - 상세: 클래스 수준 docstring은 `gauge=관측, log=cooldown 통지로 역할 분리`를 잘 설명하지만, `checkOnce` 메서드 JSDoc은 "큐 depth 1회 점검. failed >= threshold 이고 cooldown 경과 시 알람 로그 발생"으로만 기술되어 있다. 독자가 `checkOnce`만 읽으면 gauge 관측이 `onModuleInit`에서 별도로 등록됨을 알 수 없다. 이전 리뷰(12_32_02/documentation.md 발견사항 3)에서도 제기된 미조치 항목이다.
  - 제안: `checkOnce` JSDoc 첫 줄에 "큐 깊이 관측(gauge)은 `onModuleInit` 에서 등록된 provider 가 별도로 담당한다; 본 메서드는 임계 초과 알람(log) 전용." 한 줄을 추가한다.

### 발견사항 3
- **[INFO]** `execution-engine.service.ts` — `recordNodeLatencyMetrics`의 `durationMs == null` 방어 로직에 인라인 주석이 추가됐지만 null이 될 수 있는 구체적 조건이 메서드 JSDoc에만 있고 해당 코드 라인 옆에는 없다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L9404
  - 상세: 메서드 JSDoc(L9384-9385)에 `durationMs == null 는 미완료·레거시 row` 라고 기술되어 있으나, 실제 `if (row.durationMs == null) continue;` 코드 라인(L9404)에는 인라인 설명이 없다. 이전 리뷰(12_32_02/documentation.md 발견사항 4, INFO #10)에서 제안된 `// durationMs 는 NodeExecution 완료 시점에 엔진이 채운다. 미완료·레거시 row 는 null 일 수 있어 건너뜀` 형태의 인라인 주석이 추가되지 않았다.
  - 제안: `if (row.durationMs == null) continue;` 줄 옆에 `// 미완료·레거시 row — finishedAt 미기록 시 null` 정도의 짧은 인라인 주석을 추가한다.

### 발견사항 4
- **[INFO]** `metrics.module.ts` — JSDoc이 `@Global` 사용 이유("여러 feature 모듈이 계측하므로 @Global 분리")는 설명하지만, 별도 모듈로 분리한 근거(왜 기존 모듈에 서비스를 추가하지 않았는가)가 없다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/metrics.module.ts` L4-7
  - 상세: 현재 주석은 "무엇을 하는지"(NF-OB-07 도메인 메트릭, @Global 효과)를 잘 설명하지만, 왜 독립 모듈로 분리됐는지(계측 지점이 execution-engine·llm·continuation 등 다수 도메인에 분산되어 단일 feature 모듈에 귀속시키기 어려움)에 대한 설명이 없다. `RedisModule` JSDoc과 비교해도 rationale 측면이 부족하다. 이전 리뷰(12_32_02/documentation.md 발견사항 7)에서 제기된 항목으로 미조치 상태다.
  - 제안: JSDoc에 "(여러 feature 모듈에 걸쳐 계측 지점이 분산되므로 단일 feature 모듈에 귀속 불가 — @Global 분리로 각 모듈의 재import 없이 주입 가능)" 한 줄을 추가한다.

### 발견사항 5
- **[INFO]** `.env.example` — `OTEL_PROMETHEUS_HOST=127.0.0.1` 항목은 이미 추가되어 있으나, `NF-OB-07 BusinessMetricsService`가 새로 도입한 도메인 메트릭(5종 instrument)에 대한 설명이 `.env.example` 주석에 없다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/.env.example` L310-323
  - 상세: `OTEL_PROMETHEUS_HOST` 항목은 이미 존재하며 이전 리뷰 INFO #11("`.env.example` `OTEL_PROMETHEUS_HOST=127.0.0.1` 항목 추가 확인")은 해소됐다. 그러나 `OTEL_ENABLED=true` 시 노출되는 메트릭이 이제 HTTP/runtime 기본값 외에 NF-OB-07 도메인 메트릭(5종)을 포함한다는 사실이 해당 주석 블록에 반영되어 있지 않다. 운영자가 `.env.example`만 보면 어떤 메트릭이 노출되는지 파악하기 어렵다.
  - 제안: `.env.example` L312-316 주석 블록에 "도메인/비즈니스 커스텀 메트릭(NF-OB-07: clemvion.execution.total 등 5종)도 OTEL_ENABLED=true 시 노출됨 — spec/5-system/_product-overview.md §5 참조" 정도를 추가한다. 선택적 개선이므로 즉시 차단 요인은 아님.

### 발견사항 6
- **[INFO]** `spec/5-system/_product-overview.md` NF-OB-07 카탈로그 — `clemvion.node.duration` histogram의 bucket 정책이 명시되어 있지 않다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/spec/5-system/_product-overview.md` L87 (`clemvion.node.duration` 행)
  - 상세: 카탈로그 표에 `clemvion.node.duration`은 "Histogram (ms), node_type·status, 노드 실행 지연"으로만 기술되어 있다. 실제 구현(`business-metrics.service.ts` L68-71)은 OTel 기본 bucket을 사용한다. 노드 실행 시간 분포가 ms 단위 fine-grained 관측이 필요한 경우 기본 bucket(최대 5000ms)이 적합하지 않을 수 있으며, 운영팀이 p95/p99를 Grafana에서 볼 때 bucket 설정 근거가 없다. 이전 리뷰(12_32_02/documentation.md 발견사항 5)에서도 제기됐으나 미조치다.
  - 제안: 카탈로그 표 `clemvion.node.duration` 행 의미 칼럼 끝에 "(기본 OTel bucket 사용; ms 단위 세분화 필요 시 `ExplicitBucketHistogramAggregation` 재구성 가능)" 주석을 추가한다.

### 발견사항 7
- **[INFO]** `emitTerminalExecutionMetrics` JSDoc — `persisted` 파라미터의 의미가 설명되지 않는다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L9353-9358 (메서드 JSDoc)
  - 상세: 메서드 JSDoc은 "terminal 전이 시 메트릭을 기록한다. 메트릭 실패가 실행 경로에 영향을 주지 않도록 전부 무동작-안전하다"로 기술되어 있으나, `persisted: boolean` 파라미터가 왜 필요한지(DB 저장에 실패한 경우 메트릭도 기록하지 않는 정책) 설명이 없다. `if (!persisted) return;` 분기의 의도를 파악하려면 호출부 맥락을 역추적해야 한다.
  - 제안: JSDoc에 `@param persisted - DB 저장 성공 여부; false 이면 상태가 확정되지 않으므로 메트릭 기록을 건너뛴다` 한 줄을 추가한다.

## 요약

이번 변경(NF-OB-07 도메인 메트릭 파이프라인)은 전반적으로 문서화 수준이 양호하다. `BusinessMetricsService` 클래스 JSDoc은 no-op 동작·이원화 정책·spec 참조를 모두 포함하고, `continuation-dlq-monitor.service.ts` 클래스 docstring도 gauge/log 역할 분리를 명확히 설명하며, spec `_product-overview.md`에 NF-OB-07 메트릭 카탈로그 표가 단일 진실로 정립되어 있다. `.env.example`에도 `OTEL_PROMETHEUS_HOST` 항목이 이미 존재해 이전 리뷰의 INFO #11 우려가 해소됐다. 발견된 항목은 전부 INFO 수준이며, `recordLlmTokens` 파라미터 타입 관계 미설명·`checkOnce` JSDoc에서의 gauge 역할 분리 누락·`durationMs == null` 인라인 주석 부재 등은 이전 리뷰(12_32_02)에서도 지적됐으나 낮은 우선순위로 이번에도 미조치된 항목들이다. `emitTerminalExecutionMetrics`의 `persisted` 파라미터 미설명은 이번 리뷰에서 신규 발견된 소규모 개선 사항이다. 어떤 항목도 기능 오류나 즉각적인 문서 오류를 유발하지 않는다.

## 위험도

LOW

---

STATUS: SUCCESS
