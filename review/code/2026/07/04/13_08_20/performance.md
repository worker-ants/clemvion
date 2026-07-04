# 성능(Performance) Review

대상: PR4 — execution-run 큐 stalled 자동 재배달 + dead-letter 마감 + DLQ 모니터.

## 발견사항

- **[INFO]** DLQ 모니터 alarm 로그가 cooldown 내에도 `checkOnce` 자체는 매 interval(기본 60s) 마다 Redis `getJobCounts` 호출을 수행
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run-dlq-monitor.service.ts:625-627`, `642-688`
  - 상세: `setInterval` 이 `intervalMs`(기본 60_000ms) 마다 무조건 `checkOnce()` 를 호출하고, 그 안에서 매번 `queue.getJobCounts('failed','delayed')` 를 Redis 에 질의한다. cooldown 은 알람(로그) 발생만 억제할 뿐 조회 자체는 억제하지 않는다. `ContinuationDlqMonitorService` 와 동일 패턴을 따른 것으로 보이며, 60초 주기 단일 Redis round-trip은 부하가 경미해 실질적 문제는 아니다.
  - 제안: 현행 유지로 충분. 다만 다수의 DLQ 모니터(예: 향후 큐가 늘어날 경우)가 개별 interval 로 각자 폴링하면 Redis 호출이 선형 증가하므로, 향후 큐 종류가 늘어난다면 단일 스케줄러로 여러 큐를 한 번에 `getJobCounts` 하는 통합을 고려.

- **[INFO]** `finalizeStalledExhausted` 는 Execution UPDATE 성공 후 NodeExecution cascade UPDATE 를 순차 실행(직렬 await) — 두 단계 모두 조건부 UPDATE 라 N+1 은 아님
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:267-316`
  - 상세: `executionRepository` UPDATE 1건 → (affected>0 시) `nodeExecutionRepository` UPDATE 1건(`WHERE execution_id = :id AND status='running'`, 자식 전체 일괄 처리) → `emitExecution`. 반복문 내 개별 row 처리가 아니라 집합 단위 conditional UPDATE 이므로 N+1 문제 없음. 순차 실행(2 쿼리 + emit)은 dead-letter 마감이라는 저빈도 이벤트(job 실패 시 1회)이므로 지연이 문제되지 않는다.
  - 제안: 변경 불필요.

- **[INFO]** `onFailed` 핸들러에서 `finalizeStalledExhausted` 를 fire-and-forget(`void … .catch(...)`)으로 호출 — BullMQ 이벤트 핸들러를 블로킹하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.processor.ts:819-827`
  - 상세: `@OnWorkerEvent('failed')` 핸들러는 동기 시그니처(`void`)이므로 내부에서 `await` 하지 않고 `void promise.catch(...)` 로 처리한 것은 BullMQ 워커 이벤트 루프를 블로킹하지 않는 올바른 패턴. 실패 시 로그만 남기고 worker 처리 흐름에 영향 없음.
  - 제안: 현행 유지.

- **[INFO]** `runExecutionFromQueue` RUNNING 분기가 `redriveStuckExecution` 호출 시 매번 `rehydrateContext` + `loadAndBuildGraph` 로 전체 workflow 그래프·완료 노드 로그를 재구성
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3142-3151`, `2870-2874`
  - 상세: 이 경로 자체(`redriveStuckExecution`, `rehydrateContext`, `loadAndBuildGraph`)는 PR3 에서 이미 도입된 기존 로직이며 본 PR(PR4)의 diff 범위는 아니다. 다만 PR4 가 이 경로를 "BullMQ 자동 stalled 재배달"이라는 새 트리거로 호출 빈도를 늘리므로 참고차 기록: `maxStalledCount:1` 로 재배달이 최대 1회로 bound 되어 있어 poison workflow 로 인한 반복 비용 증폭은 제한적이다.
  - 제안: 변경 불필요(범위 밖). 향후 재배달 횟수가 늘어날 경우(`maxStalledCount` 상향) 그래프 재로딩 캐싱 여지를 별도로 검토.

- **[INFO]** `EXECUTION_RUN_STALLED_INTERVAL_MS = 30_000` (BullMQ 기본값과 동일) — heartbeat 오탐 가능성과 무관하게 순수 설정값이라 성능 영향 없음
  - 위치: `codebase/backend/src/modules/execution-engine/queues/execution-run.queue.ts:915-922`
  - 상세: stalled 판정 주기를 30초로 설정. 값 자체는 BullMQ 기본과 일치하며 트래픽/부하에 영향을 주는 파라미터가 아니므로 성능 리스크 없음.
  - 제안: 없음.

## 요약
이번 PR4 변경분(모니터 서비스, dead-letter 마감 UPDATE 경로, `runExecutionFromQueue` 3-way 분기, config 로더)은 모두 집합 단위 조건부 UPDATE·저빈도 이벤트(job 실패 1회, DLQ 폴링 60초 주기)로 구성되어 있어 N+1 쿼리, O(n²) 누적, 블로킹 I/O, 불필요한 대규모 메모리 할당 등 성능 임계 이슈가 발견되지 않았다. 유일하게 언급할 만한 지점은 기존(PR3) `redriveStuckExecution`/`rehydrateContext` 경로가 PR4 의 새 자동 트리거(BullMQ stalled 재배달)로 호출 빈도가 늘어난다는 점이나, `maxStalledCount:1` 로 재배달 자체가 bound 되어 있어 실질적 위험은 낮다.

## 위험도
NONE
