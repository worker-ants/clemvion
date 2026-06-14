# 요구사항(Requirement) Review — NF-OB-07 비즈니스 커스텀 메트릭 (2차 리뷰)

## 발견사항

### [INFO] 기능 완전성 — NF-OB-07 카탈로그 5종 instrument 모두 구현됨
- 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts`
- 상세: spec `_product-overview.md` §5 NF-OB-07 카탈로그가 정의하는 5개 instrument(`clemvion.execution.total`, `clemvion.execution.errors`, `clemvion.queue.depth`, `clemvion.llm.tokens`, `clemvion.node.duration`)가 모두 `BusinessMetricsService` 생성자에서 올바른 종류(Counter/ObservableGauge/Histogram)로 생성된다. 메터 이름(`clemvion.business`)·instrument 이름·라벨 키가 spec 카탈로그 표와 line-level 로 일치한다.
- 제안: 해당 없음.

### [INFO] 계측 단일 지점 — spec 요구사항과 구현 일치
- 위치: `llm-usage-log.service.ts` L39, `execution-engine.service.ts` L9366, `continuation-dlq-monitor.service.ts` L61
- 상세: spec NF-OB-07 카탈로그의 "단일 지점" 명세 — (1) `clemvion.llm.tokens` 는 `LlmUsageLogService.record` 단일 지점, (2) `clemvion.execution.total/errors` 는 `updateExecutionStatus` 단일 chokepoint(`emitTerminalExecutionMetrics`), (3) `clemvion.queue.depth` 는 observable gauge callback — 이 모두 구현과 일치한다.
- 제안: 해당 없음.

### [INFO] 이원화 정책 — 구현이 spec 정책과 일치
- 위치: `llm-usage-log.service.ts`, `execution-engine.service.ts`
- 상세: spec이 "OTel 메트릭은 운영 관측 보조, Statistics API가 제품 분석 SoT"로 정의한 이원화 정책이 코드에 반영된다. `recordLlmTokens`는 DB insert 성패와 무관하게 계측하며(별도 try/catch 격리), DB insert 실패가 메트릭 기록을 막지 않는다.
- 제안: 해당 없음.

### [INFO] 에러 격리 — 메트릭 실패가 실행 경로에 영향 없음
- 위치: `execution-engine.service.ts` L9411 (catch {}), `llm-usage-log.service.ts` L40-46
- 상세: spec NF-OB-07 정신("운영 관측 보조, 실행 경로 차단 금지")에 따라 모든 계측 경로가 오류 swallow 또는 격리 try/catch 로 처리된다. `emitTerminalExecutionMetrics` 자체는 void, `recordNodeLatencyMetrics`는 fire-and-forget, `recordLlmTokens`는 별도 try/catch.
- 제안: 해당 없음.

### [INFO] `enabled=false` 시 큐 depth gauge 등록 — 설계 의도와 구현 일치
- 위치: `continuation-dlq-monitor.service.ts` L58-77
- 상세: spec §9.3 L1098 "큐 깊이(waiting/active/delayed/failed)는 `registerQueueDepthProvider`를 통해 `clemvion.queue.depth` ObservableGauge로 NF-OB-07에도 노출"의 구현에서, `registerQueueDepthProvider` 호출이 `if (!this.config.enabled)` 분기 이전에 위치한다. 인라인 주석("알람(아래)이 비활성이어도 깊이 관측은 유효")이 의도를 설명한다. 테스트(`enabled=false 에도 registerQueueDepthProvider 1회 호출`)가 이 동작을 검증한다.
- 제안: 해당 없음.

### [INFO] `recordLlmTokens` falsy 체크 — 의도된 동작, 음수 방어 부재
- 위치: `business-metrics.service.ts` L97-105
- 상세: `if (usage.inputTokens)` 형태의 falsy 체크는 `0`과 `undefined`/`null`을 동일하게 건너뛴다. spec NF-OB-07은 0 처리 정책을 명시하지 않으므로 spec 침묵 영역이다. 테스트(`0 은 건너뜀`)가 이 동작을 명시 검증한다. 음수 토큰이 전달될 경우 falsy 체크를 통과해 OTel Counter에 음수 increment가 발생하나, 현재 호출 경로(LLM API 응답)에서 음수는 발생하지 않는다.
- 제안: 즉각 수정 대상 아님. `if (usage.inputTokens > 0)` 형태로 명시적 양수 검증을 선택적으로 고려.

### [INFO] `recordExecutionError` — error_code 64자 클램핑 구현 확인
- 위치: `business-metrics.service.ts` L91
- 상세: `errorCode.substring(0, 64)` 클램핑이 구현되어 있다. 이전 리뷰(RESOLUTION #I-1)에서 요구된 수정이 반영됐다. spec NF-OB-07은 "bounded cardinality"를 요구하며 클램핑은 그 구현 수단으로 적절하다.
- 제안: 해당 없음.

### [INFO] SPEC-DRIFT — spec §9.3 본문과 §Rationale 현행화 확인
- 위치: `spec/5-system/4-execution-engine.md` L1098, L1396-1397
- 상세: 이전 리뷰(RESOLUTION #6 SPEC-DRIFT)에서 식별된 `spec §9.3` 본문 stale 및 §Rationale "OTel traces-only" 전제 모순이 이번 PR 범위에서 현행화됐다. 현재 spec L1098은 "큐 깊이...`clemvion.queue.depth` ObservableGauge로 NF-OB-07에도 노출"을 명시하고, §Rationale L1396-1397은 "현행화(NF-OB-02 · NF-OB-07 이후)" 박스로 최신 상태를 기술한다. 구현과 spec 본문이 line-level로 일치한다.
- 제안: 해당 없음 — 이미 수정 완료.

### [INFO] 이전 리뷰 `BusinessMetricsService` 중복 등록 — 해소 확인
- 위치: `execution-engine.service.spec.ts` L15295-15298
- 상세: 이전 리뷰에서 WARNING으로 식별된 동일 `createTestingModule` providers 배열 내 `BusinessMetricsService` 이중 등록이 현재 코드에서 해소됐다. `describe('SUMMARY W3 / W5 / W6 / W7...')` 블록 내 `module3`에 `BusinessMetricsService`가 단 1회만 등록된다(L15298). 최종 NF-OB-07 메트릭 단위 테스트 describe는 별도 `useValue: mockBizMetrics` 패턴으로 올바르게 격리된다.
- 제안: 해당 없음.

### [INFO] `continuation-dlq-monitor.service.spec.ts` — `as unknown as BusinessMetricsService` 타입 캐스트 확인
- 위치: `continuation-dlq-monitor.service.spec.ts` L89
- 상세: 이전 리뷰 W-8에서 `as never` 타입 우회를 `as unknown as BusinessMetricsService`로 교체하도록 요구했으며, 현재 코드에 반영됐다. TypeScript 타입 시스템이 인터페이스 변경 시 이 테스트에서 컴파일 오류를 잡을 수 있게 됐다.
- 제안: 해당 없음.

### [INFO] `observeQueues` — `Promise.allSettled` 병렬 폴링 구현 확인
- 위치: `business-metrics.service.ts` L133-153
- 상세: 이전 리뷰 I-4에서 요구된 직렬 폴링 → `Promise.allSettled` 병렬 폴링 전환이 반영됐다. 스냅샷 이터레이션(`const providers = [...this.queueProviders]`)으로 await 양보 중 새 provider push 격리도 구현됐다(SUMMARY W-2).
- 제안: 해당 없음.

### [INFO] `TERMINAL_STATUSES` 정적 Set 추출 확인
- 위치: `execution-engine.service.ts` L701-705
- 상세: 이전 리뷰 I-5에서 요구된 `terminal` 배열을 매 호출마다 재생성하는 문제를 `private static readonly TERMINAL_STATUSES = new Set<ExecutionStatus>([...])` 로 추출·해소됐다. `emitTerminalExecutionMetrics`에서 `ExecutionEngineService.TERMINAL_STATUSES.has(newStatus)` O(1) 탐색을 사용한다.
- 제안: 해당 없음.

---

## 요약

NF-OB-07 비즈니스 커스텀 메트릭 구현은 이전 리뷰(12_32_02) 이후 모든 CRITICAL/WARNING 항목이 해소된 상태로 요구사항을 완전히 충족한다. spec `_product-overview.md` §5 NF-OB-07 카탈로그의 5개 instrument(이름·종류·라벨)가 `BusinessMetricsService`에서 line-level로 일치하고, 계측 단일 지점(execution-engine `updateExecutionStatus` chokepoint, `LlmUsageLogService.record`, continuation DLQ queue depth provider)이 spec 명세와 일치한다. 이원화 정책, 에러 격리(fire-and-forget, 별도 try/catch), no-op meter 안전성 모두 구현됐다. spec §9.3 및 §Rationale의 stale 기술도 이번 PR에서 현행화 완료됐다. 이전 리뷰에서 지적된 `BusinessMetricsService` 중복 등록, `as never` 타입 우회, `Promise.allSettled` 미사용, `TERMINAL_STATUSES` 배열 재생성 등이 모두 해소됐다. 신규 발견되는 CRITICAL 또는 WARNING 항목 없음.

## 위험도

NONE
