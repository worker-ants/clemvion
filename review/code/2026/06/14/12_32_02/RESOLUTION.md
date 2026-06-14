# RESOLUTION — 12_32_02

## 조치 항목

| SUMMARY # | 분류 | 조치 commit | 비고 |
|-----------|------|-------------|------|
| #1 | CONCURRENCY (false-positive) | 482901c4 | async ObservableCallback 의도적 패턴 주석 추가 — SDK 가 await 하는 정식 패턴. 코드 변경 없음 |
| #2 | CONCURRENCY | 482901c4 | observeQueues `const providers=[...this.queueProviders]` 스냅샷 이터레이션 |
| #3 | TESTING | 482901c4 | execution-engine.spec 에 mock BusinessMetricsService describe 추가 — emitTerminalExecutionMetrics 4케이스 |
| #4 | TESTING | 482901c4 | continuation-dlq-monitor.spec lifecycle 에 registerQueueDepthProvider 3케이스 추가 |
| #5 | TESTING | 482901c4 | execution-engine.spec recordNodeLatencyMetrics 4케이스 (durationMs=null·node=null fallback·reject swallow·정상) |
| #6 | SPEC-DRIFT | 3fbc5750 | spec/5-system/4-execution-engine.md §9.3 L1082 — 큐 깊이 ObservableGauge 노출 명시, 코드 무수정 |
| #7 | CODE-QUALITY | 482901c4 | execution-engine.spec.ts L15293 중복 `BusinessMetricsService` 한 줄 제거 |
| #8 | MAINTAINABILITY | 482901c4 | continuation-dlq-monitor.spec `as never` → `as unknown as BusinessMetricsService` + import 추가 |
| #9 | PERFORMANCE | 482901c4 | recordNodeLatencyMetrics `find({relations:['node']})` → QueryBuilder(id/duration_ms/status+node.type 4컬럼) |
| #10 | ARCHITECTURE | — (defer) | QUEUE_DEPTH_PROVIDER DI 토큰 패턴 전환 — 중기 아키텍처 개선, plan 후속 기록 |
| #11 | SIDE-EFFECT | 482901c4 | LlmUsageLogService.record `recordLlmTokens` 를 자체 try/catch 로 격리 — OTel 오류가 DB insert 차단 방지 |
| #12 | ARCHITECTURE | — (defer) | ExecutionMetricsCollector 별도 서비스 SRP 분리 — 중기, plan 후속 기록 |

## TEST 결과

- lint  : 통과
- unit  : 통과 (6886 passed, 345 suites — backend; 40 passed frontend)
- build : 통과
- e2e   : 통과 (190/190)

## 보류·후속 항목

- WARNING #10 (ARCHITECTURE): `QUEUE_DEPTH_PROVIDER` 다중 주입 DI 토큰 패턴으로 push-등록 암묵적 계약 해소 — `plan/in-progress/spec-sync-5-system-metrics-gap.md` 후속 기록
- WARNING #12 (ARCHITECTURE): `ExecutionEngineService` 내 observability 코드를 `ExecutionMetricsCollector` 별도 서비스로 SRP 분리 — 동 plan 후속 기록
- INFO #3 (SECURITY): observeQueues provider 타임아웃 (Promise.race 패턴) — 동 plan 후속 기록
- INFO #11 (DOCUMENTATION): `.env.example` `OTEL_PROMETHEUS_HOST=127.0.0.1` 항목 추가 확인 — 동 plan 후속 기록
- INFO #12 (CONCURRENCY): 다중 Pod cooldown 분산 잠금 — 동 plan 후속 기록
- INFO #13 (DATABASE): node_executions `(execution_id, status)` 복합 인덱스 존재 확인 — 동 plan 후속 기록
- INFO #6 (TESTING): recordLlmTokens 음수 입력 케이스 — 정책 결정 후 추가 가능 (boundedness 확인 필요)
- INFO #7 (TESTING): 복수 gauge provider 모두 성공 합산 관측 케이스 — 필요 시 추가
- INFO #9 (DOCUMENTATION): LlmTokenUsage export 또는 JSDoc @param 추가 — 낮은 우선순위
- INFO #10 (DOCUMENTATION): recordNodeLatencyMetrics durationMs null 인라인 주석 — 낮은 우선순위
- INFO #14 (ARCHITECTURE): LlmTokenUsage vs TokenUsage 구조 중복 — 중기 공통 타입 검토
- INFO #15 (MAINTAINABILITY): recordLlmTokens falsy 체크 명시적 표현 — 낮은 우선순위

선택 반영 INFO (이번 PR 처리 완료):
- I-1: recordExecutionError error_code.substring(0,64) 클램핑
- I-2: observeQueues catch Logger.warn 추가
- I-4: observeQueues Promise.allSettled 병렬 폴링
- I-5: TERMINAL_STATUSES static readonly Set 추출
- I-8: metrics.module.spec.ts smoke 테스트 신규 추가
