# 요구사항(Requirement) Review — NF-OB-07 비즈니스 커스텀 메트릭

## 발견사항

### [WARNING] 중복 `BusinessMetricsService` 등록 — 테스트 모듈 내 이중 provider
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L15293–15294
- **상세**: `SUMMARY W3 / W5 / W6 / W7` describe 블록의 `module3` 생성에서 `BusinessMetricsService` 가 두 번 연속 등록돼 있다. NestJS TestingModule 은 동일 클래스를 중복 등록해도 마지막 것이 이기는 방식으로 동작해 런타임 에러는 발생하지 않지만, 의도치 않은 이중 provider 선언은 코드베이스 일관성을 깨뜨리고 혼란을 야기한다.
- **제안**: 두 번째 `BusinessMetricsService` 줄(L15294)을 제거한다.

### [WARNING] [SPEC-DRIFT] spec §9.3 본문에 "메트릭 SDK 대신 로그 기반" 기술이 잔류
- **위치**: `spec/5-system/4-execution-engine.md` L1082
- **상세**: spec §9.3 "Dead-letter 모니터링" 본문의 `ContinuationDlqMonitorService` 설명이 "메트릭 SDK 대신 로그 기반을 택한 근거는 §Rationale 참조"라고 명시한다. 그러나 이 변경에서 `ContinuationDlqMonitorService` 는 이미 `BusinessMetricsService.registerQueueDepthProvider` 를 통해 `clemvion.queue.depth` ObservableGauge 에 큐 깊이를 노출하고 있다. §Rationale 섹션은 이번 변경에서 현행화됐으나, §9.3 본문 행동 명세(L1082)가 여전히 구식 설명("메트릭 SDK 대신")을 유지해 본문 요구사항 설명과 실제 구현이 일치하지 않는다. 코드가 옳고 spec 본문이 낡았다.
- **제안**: 코드 유지 + spec 반영. `spec/5-system/4-execution-engine.md` §9.3 L1082 의 `ContinuationDlqMonitorService` 설명에 "임계 초과 알람은 log 기반, 큐 깊이(waiting/active/delayed/failed)는 `clemvion.queue.depth` ObservableGauge 로 NF-OB-07 에도 노출" 내용을 추가한다.

### [INFO] `recordLlmTokens` 의 `outputTokens: 0` 처리 — falsy 체크
- **위치**: `codebase/backend/src/modules/metrics/business-metrics.service.ts` L89–98
- **상세**: `if (usage.outputTokens)` 는 `0` 뿐 아니라 `undefined`·`null` 도 skip 한다. 이는 의도된 동작(0 토큰 미기록)이며 테스트(`recordLlmTokens → type 별로 누적, 0 은 건너뜀`)도 이를 명시 검증하고 있다. spec NF-OB-07 카탈로그는 해당 조건을 특정하지 않아 spec 침묵 영역이다. 다만 음수 토큰이 전달될 경우 falsy 체크를 통과해 Counter 에 음수가 기록된다. OTel Counter 는 음수 increment 가 정의되지 않은 동작(monotonically increasing)이므로, 입력이 항상 LlmService 경로를 통해 양수임을 보장한다면 허용 가능하다. 그렇지 않으면 방어 검증이 필요하다.
- **제안**: 현재 호출 경로(LlmUsageLogService.record → tokenUsage from API 응답)는 음수가 발생하지 않으므로 즉각 수정 대상은 아니다. 단, `if (usage.inputTokens > 0)` 형태로 명시적 양수 검증을 권장한다.

### [INFO] `recordNodeLatencyMetrics` — `relations: ['node']` N+1 조회 가능성
- **위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L9380–9389
- **상세**: `nodeExecutionRepository.find({ ..., relations: ['node'] })` 는 terminal node_execution 전체를 한 번에 조회하며, 그 안에서 `node` relation JOIN 을 한다. 단일 쿼리로 동작하므로 N+1 문제는 없다. 다만 실행에 수백 노드가 있으면 `node` relation 의 `type` 컬럼 하나를 위해 Node 행 전체를 로드한다. fire-and-forget + 에러 swallow 로 실행 경로에 영향 없으며, 현재 스케일에서는 허용 가능하다.
- **제안**: 현재 허용. 향후 최적화 시 `select: ['id', 'node.type']` + `leftJoinAndSelect` 방식 검토.

### [INFO] `ContinuationDlqMonitorService` spec 테스트 — `registerQueueDepthProvider` 호출 여부 미검증
- **위치**: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.spec.ts` L380 이후 lifecycle describe
- **상세**: `onModuleInit` lifecycle 테스트는 setInterval/clearInterval 동작만 검증한다. `enabled=false` 시에도 `registerQueueDepthProvider` 가 호출되어야 한다는 동작(구현의 의도 — "알람 비활성이어도 깊이 관측은 유효")이 테스트에서 검증되지 않는다. `registerQueueDepthProvider` mock 이 반환값에 포함돼 있어 향후 검증 추가가 가능한 구조이나 현재 테스트는 해당 mock 을 실제로 assertion 하지 않는다.
- **제안**: `lifecycle` describe 에 `onModuleInit 이 enabled 여부 무관하게 registerQueueDepthProvider 를 호출한다` 케이스 추가를 권장한다.

---

## 요약

NF-OB-07 비즈니스 커스텀 메트릭 구현은 전반적으로 의도한 기능을 완전히 충족한다. `BusinessMetricsService` 5개 instrument 정의·계측 지점(execution-engine 단일 chokepoint, LlmUsageLogService, DLQ monitor queue depth provider)·@Global MetricsModule 등록·no-op meter 안전성·오류 swallow 설계 모두 spec NF-OB-07 카탈로그 및 관련 구현 의도와 일치한다. 주요 우려 사항은 하나로, `execution-engine.service.spec.ts` 의 특정 describe 블록에 `BusinessMetricsService` 가 중복 등록된 코드 품질 문제(WARNING)이다. spec §9.3 본문의 "메트릭 SDK 대신 로그 기반" 기술이 구현 현실과 달라 SPEC-DRIFT(WARNING)가 발생하며, 코드가 옳고 spec 본문이 갱신되지 않은 상태다.

## 위험도

LOW
