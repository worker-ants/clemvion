# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 메트릭 라벨에 사용되는 외부 유래 문자열에 대한 cardinality 제한이 일부 누락
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` — `recordLlmTokens(model: string, ...)`, `recordNodeDuration(nodeType: string, status: string, ...)`
  - 상세: `recordExecutionError` 는 `errorCode.substring(0, 64)` 클램핑이 적용되어 있다(SUMMARY I-1 반영 완료). 그러나 `recordLlmTokens` 의 `model` 파라미터와 `recordNodeDuration` 의 `nodeType`, `status` 파라미터에는 동일한 길이 클램핑이 없다. 이 값들이 DB에 저장된 값이나 내부 enum 에서 유래한다면 현실적 위험은 낮다. 단, 호출 경로에서 외부 입력이 직접 전달될 경우 비정상적으로 긴 문자열이 Prometheus 라벨로 기록될 수 있다. OTel Prometheus exporter 가 일부 sanitize 를 수행하므로 직접 인젝션 위험은 없으나, cardinality 폭발로 인한 메트릭 저장소 과부하 가능성이 있다.
  - 제안: `recordLlmTokens` 의 `model`, `recordNodeDuration` 의 `nodeType` 에 `value.substring(0, 64)` 수준의 클램핑을 추가하거나, 이 값들이 항상 bounded-cardinality 출처에서 온다는 보장을 주석으로 명시한다.

- **[INFO]** `recordLlmTokens` 의 falsy 체크가 음수 토큰을 허용
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L97-105 — `if (usage.inputTokens)` 등
  - 상세: 현재 구현은 0 을 제외하기 위해 falsy 체크(`if (usage.inputTokens)`)를 사용한다. 이는 의도된 동작이나, 음수 값이 전달될 경우 OTel Counter 에 음수가 기록된다. OTel Counter 는 단조 증가(monotonically increasing)를 정의하므로 음수 delta 는 정의되지 않은 동작이다. 현재 호출 경로(LLM API 응답 → `LlmUsageLogService.record`)에서 음수 토큰이 발생할 가능성은 거의 없지만, 방어 검증이 없어 미래 코드 변경 시 조용히 위반될 수 있다.
  - 제안: `if (usage.inputTokens != null && usage.inputTokens > 0)` 형태로 명시적 양수 검증을 추가한다.

- **[INFO]** `observeQueues` 의 provider 에러 처리 — Logger.warn 추가 완료, 타임아웃 부재
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L133-153 — `observeQueues`
  - 상세: SUMMARY I-2 반영으로 `Logger.warn` 이 추가되어 Redis 장애 시 메트릭 블라인드 상황을 인지할 수 있게 되었다(긍정적). 그러나 provider 호출 타임아웃이 없다(I-3 후속 분리). 악의적 또는 버그 있는 provider 가 등록된 경우, 또는 Redis 연결이 장시간 hang 되는 경우 OTel 수집 주기 전체가 차단될 수 있다. 보안 가시성 측면에서 큐 깊이 모니터링이 지속적으로 블라인드 처리되는 시나리오가 발생할 수 있으나, 실제 알람은 `ContinuationDlqMonitorService` 의 별도 로그 기반 경로가 담당하므로 위험도는 낮다.
  - 제안: plan 후속(I-3)으로 등록된 `Promise.race([provider(), timeout(5000)])` 패턴을 중기적으로 구현한다. 당장의 차단 사유는 없다.

- **[INFO]** `registerQueueDepthProvider` — 미검증 async 콜백 등록 허용
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L124-126 — `registerQueueDepthProvider`
  - 상세: `@Global` 서비스로 어느 모듈에서나 주입 가능하며, 임의의 async 함수를 provider 로 등록할 수 있다. NestJS DI 체계 밖에서 직접 접근하거나 악의적 모듈이 주입되는 경우는 아닐지라도, provider 실행 타임아웃 부재(위 항목)와 결합 시 무한 루프 / 느린 쿼리가 등록될 경우 gauge 수집을 차단할 수 있다. 현재 등록 지점은 2곳(`ExecutionEngineService.onModuleInit`, `ContinuationDlqMonitorService.onModuleInit`)으로 제한되어 있으며, 제어된 내부 경로에서만 호출된다.
  - 제안: 현재 사용 패턴에서는 위험이 매우 낮다. 타임아웃 추가(I-3)와 함께 W-10(DI 토큰 패턴 전환) 아키텍처 개선을 중기 조치로 병행하면 등록 경로가 명시적으로 제어된다.

- **[INFO]** DLQ 알람 로그에 내부 임계값 설정 노출
  - 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — DLQ ALARM 로그 라인
  - 상세: `[DLQ ALARM]` 로그에 `failed`(실제 큐 깊이)와 `this.config.thresholdJobs`(설정된 임계값)가 노출된다. 로그 파이프라인이 외부에 노출될 경우 내부 처리 용량 정보가 공격자에게 제공될 수 있다. 운영 로그의 일반적 범위이므로 직접적 취약점은 아니나, 로그 접근 통제 미비 시 정보 노출이 된다.
  - 제안: 해당 로그가 외부 대시보드나 미인증 로그 수집 시스템에 노출되는지 운영 설정을 점검한다.

- **[INFO]** `recordNodeLatencyMetrics` — QueryBuilder 파라미터 바인딩 확인
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L9387-9414 — `recordNodeLatencyMetrics`
  - 상세: `executionId` 는 `.where('ne.execution_id = :executionId', { executionId })` 형태로 TypeORM QueryBuilder 파라미터 바인딩을 사용하고 있어 SQL 인젝션 위험이 없다. `statuses` 도 `:...statuses` 바인딩으로 처리된다. `execution.error?.code` 는 `execution.error.code.substring(0, 64)` 클램핑 후 OTel 라벨로만 사용되며 DB 쿼리에 삽입되지 않는다. SQL 인젝션 취약점 없음.
  - 제안: 현재 패턴이 안전하다. 추가 조치 불필요.

- **[INFO]** 하드코딩된 시크릿 없음 확인
  - 위치: 변경된 모든 파일
  - 상세: API 키, 비밀번호, 토큰, 인증서 등 하드코딩된 시크릿이 발견되지 않았다. OTel meter 이름(`clemvion.business`)은 식별자이며 시크릿이 아니다. 큐 이름 상수도 운영 시크릿이 아니다.
  - 제안: 해당 없음.

- **[INFO]** 에러 메시지에서 민감 정보 노출 없음 확인
  - 위치: `/codebase/backend/src/modules/llm/llm-usage-log.service.ts` L358-366 — OTel 오류 격리 try/catch; `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L138-143
  - 상세: OTel 오류 메시지를 `logger.warn` 으로 기록할 때 `metricError.message` 또는 `String(settled.reason.message)` 만 사용한다. 스택 트레이스나 내부 상태(연결 문자열, 인증 토큰 등)가 로그에 포함되지 않는다. 에러 처리 패턴이 적절하다.
  - 제안: 해당 없음.

- **[INFO]** 신규 외부 의존성 추가 없음 — 알려진 취약 라이브러리 없음
  - 위치: 변경된 모든 파일
  - 상세: 이번 변경은 신규 npm 패키지를 추가하지 않고 기존 `@opentelemetry/api ^1.9.0` 만 활용한다. 알려진 취약점이 있는 패키지 신규 도입 없음.
  - 제안: 해당 없음.

## 요약

이번 변경(NF-OB-07 비즈니스 메트릭 파이프라인)은 보안 관점에서 전반적으로 안전하게 구현되었다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, XSS, 경로 탐색 등 OWASP Top 10 주요 취약점은 발견되지 않았다. TypeORM QueryBuilder 파라미터 바인딩이 올바르게 사용되고, 에러 처리에서 민감 정보가 노출되지 않으며, 모든 설정은 NestJS DI/ConfigService 패턴을 따른다. 신규 HTTP 엔드포인트가 없어 인증/인가 경계에 변화가 없다. 발견된 항목은 모두 INFO 수준으로, `model`/`nodeType` 라벨의 길이 클램핑 누락(cardinality 폭발 방어), `recordLlmTokens` 음수 입력 방어 부재, provider 타임아웃 없음 등이다. 이전 리뷰(12_32_02/security.md)에서 제기된 주요 항목 중 `error_code.substring(0,64)` 클램핑(I-1)과 `Logger.warn` 추가(I-2)는 이미 반영 완료되었다.

## 위험도

LOW

STATUS: SUCCESS
