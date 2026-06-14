# 보안(Security) 리뷰 결과

## 발견사항

- **[INFO]** 메트릭 라벨에 외부 입력이 그대로 사용됨 (제한적 위험)
  - 위치: `business-metrics.service.ts` — `recordExecutionError(errorCode: string)`, `recordNodeDuration(nodeType: string, status: string, ...)`, `recordLlmTokens(model: string, ...)`
  - 상세: 라벨 값(error_code, node_type, model, status)이 외부로부터 흘러들어올 수 있는 문자열을 그대로 OTel 속성에 주입한다. OTel 라벨은 Prometheus exporter 가 sanitize하므로 직접 인젝션 공격면은 없다. 단, `error_code` 가 내부 도메인 에러 코드(trim 적용)이고 `model` 이 DB에 저장된 값에서 온다면 cardinality 폭발 위험이 있다. 스펙에서 "bounded cardinality" 라고 명시하고 있으므로 설계 의도는 올바르나, 호출 지점에서 값을 제한하는 allowlist 또는 최대 길이 클램핑이 없다.
  - 제안: `recordExecutionError` 에 알려진 에러 코드 집합 외 값은 `'unknown'` 으로 교체하는 클램핑을 추가하거나, 최소한 문자열 길이를 제한하여 Prometheus 라벨 스토리지 폭발을 방지할 것.

- **[INFO]** `emitTerminalExecutionMetrics` 의 `execution.error?.code` 에 `.trim()` 적용 후 fallback
  - 위치: `execution-engine.service.ts` diff `+const code = (execution.error?.code as string | undefined)?.trim() || 'unknown';`
  - 상세: 구현 자체는 적절히 방어적이다(`trim` + fallback). 다만 `execution.error` 객체가 DB에서 역직렬화된 JSON이므로, `code` 필드가 임의 길이의 문자열일 수 있다는 점에 유의. OTel 라벨 문자열 길이 제한이 없다.
  - 제안: `code.substring(0, 64)` 등 최대 길이 클램핑 추가.

- **[INFO]** `BusinessMetricsService.observeQueues` — provider 에러를 silently 삼킴
  - 위치: `business-metrics.service.ts` L106-109 (catch 블록에 내용 없음)
  - 상세: Redis 연결 실패 시 에러를 완전히 무시한다. 이는 가용성 측면에서 의도된 설계이나, 공격자가 Redis를 강제 오류 상태로 만들어 큐 깊이 모니터링을 지속적으로 블라인드 처리하는 시나리오에서 보안 가시성(security visibility)이 저하될 수 있다. 단, 이는 메트릭 계층의 문제이고 실제 알람은 `ContinuationDlqMonitorService` 의 로그 기반 경로가 별도로 담당하므로 위험도는 낮다.
  - 제안: 에러 무시 대신 최소한 `Logger.warn` 을 남겨 Redis 장애 시 메트릭 블라인드 상황을 인지할 수 있도록 할 것.

- **[INFO]** `DLQ ALARM` 로그에 `depth` 와 `threshold` 값이 포함됨
  - 위치: `continuation-dlq-monitor.service.ts` L705-709
  - 상세: `logger.error('[DLQ ALARM] execution-continuation dead-letter depth=${failed} >= threshold=${this.config.thresholdJobs}...')` — 이 로그는 내부 큐 깊이와 임계값 설정을 노출한다. 로그 파이프라인이 외부에 노출될 경우 내부 처리 용량 정보를 공격자에게 제공할 수 있다. 그러나 이는 운영 로그이므로 일반적으로 허용 범위이며, 운영 인프라 접근 통제가 충분하다면 문제없다.
  - 제안: 이 로그가 외부 대시보드나 로그 수집 시스템에 노출되는 경로를 점검하고, 민감한 설정값이 로그에 노출되지 않도록 운영 정책을 확인할 것.

- **[INFO]** `registerQueueDepthProvider` — 누구나 provider 등록 가능
  - 위치: `business-metrics.service.ts` `registerQueueDepthProvider(provider: QueueDepthProvider): void`
  - 상세: `BusinessMetricsService` 가 `@Global` 로 어느 모듈에서나 주입 가능하며, `registerQueueDepthProvider` 는 임의의 async 함수를 provider로 등록한다. 악의적 또는 버그 있는 모듈이 무한 루프 / 느린 쿼리를 provider로 등록하면 OTel 수집 주기 차단이 발생할 수 있다. 현재 코드에서는 provider 실행 타임아웃이 없다.
  - 제안: provider 호출에 타임아웃(예: `Promise.race([provider(), timeout(5000)])`)을 추가하여 느린 provider가 게이지 수집 전체를 블로킹하지 않도록 할 것.

- **[INFO]** 테스트 파일 `execution-engine.service.spec.ts` 에 `BusinessMetricsService` 가 중복 등록됨
  - 위치: `execution-engine.service.spec.ts` diff 라인 `+BusinessMetricsService, +BusinessMetricsService` (SUMMARY W3/W5/W6/W7 블록)
  - 상세: 보안 취약점은 아니나, 동일 provider가 두 번 등록되면 gauge 수집 시 큐 깊이가 2배로 집계될 수 있다. 테스트에서만 발생하므로 프로덕션 영향은 없으나 의도하지 않은 동작이다.
  - 제안: 중복 등록 제거.

## 요약

이번 변경은 OTel 기반 비즈니스 메트릭 파이프라인(`BusinessMetricsService`, `MetricsModule`)을 신설하고, 이를 실행 엔진·LLM 사용 로그·DLQ 모니터 등에 연결하는 내용이다. 하드코딩된 시크릿, SQL/커맨드 인젝션, 인증 우회, 평문 전송 등 주요 보안 취약점은 발견되지 않았다. 신설된 서비스는 NestJS DI 체계 안에서 올바르게 선언되었고, 모든 설정은 환경변수 기반 ConfigService 주입 패턴을 따른다. 다만 메트릭 라벨로 사용되는 외부 유래 문자열에 길이/cardinality 제한이 없어 Prometheus 라벨 폭발 위험이 미약하게 존재하며, provider 타임아웃 부재로 OTel 수집 주기가 블로킹될 가능성이 있다. 이 두 사안은 운영 안정성과 관측성 가시성에 영향을 주지만 직접적인 보안 침해 경로는 아니다. 에러 처리에서 민감 정보 노출은 없고, 알려진 취약 라이브러리 사용도 확인되지 않는다.

## 위험도

LOW
