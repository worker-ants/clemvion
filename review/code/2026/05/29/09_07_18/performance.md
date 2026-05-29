# Performance Review

## 발견사항

### [INFO] ContinuationDlqMonitorService — 다중 인스턴스 배포 시 Redis polling 중복
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` L439-441
- 상세: `checkOnce()` 는 `queue.getJobCounts('failed', 'delayed')` 를 매번 Redis 명령으로 조회한다. 기본 polling 주기 60초는 적절하나, 다수의 서버 인스턴스가 동시 배포될 경우 모든 인스턴스가 동일 Redis 에 독립적으로 polling 하여 N-instance 배수 부하가 발생한다. BullMQ `getJobCounts` 자체는 O(1) 에 가까운 Redis 명령이므로 절대 부하는 낮으나, 인스턴스 10개 기준 60초마다 10개 쿼리가 발생한다.
- 제안: 현재 설계 수준에서는 허용 범위. 필요 시 BullMQ `QueueEvents` 이벤트 기반 리스너를 활용하거나 한 인스턴스만 모니터 역할을 담당하는 리더 선출 패턴으로 전환할 수 있다. Phase 3.1 범위(로그 기반, 메트릭 SDK 미도입) 내에서는 현재 구현이 적합하다.

### [INFO] ContinuationDlqMonitorService — setInterval 내 비동기 중첩 가능성
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` L439-441
- 상세: `setInterval` 콜백에서 `void this.checkOnce()` 를 fire-and-forget 으로 호출한다. `checkOnce` 내부의 Redis 조회가 `intervalMs`(기본 60초)보다 오래 걸리는 극단적 Redis 지연 상황에서는 이전 checkOnce 가 완료되기 전에 다음 interval tick 이 시작되어 동시 조회가 중첩될 수 있다. try/catch 로 에러가 wrapping 되어 있고 Redis 조회는 통상 수 밀리초 내 완료되므로 실질 위험은 낮다.
- 제안: 현행 유지 가능. 완전한 안전성을 원한다면 `setInterval` 대신 `setTimeout` 재귀 패턴(완료 후 다음 예약)을 사용할 수 있다.

### [INFO] resolveWaitingNodeExecutionId — 매 publish 마다 DB SELECT 쿼리 추가 발생
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` resolveWaitingNodeExecutionId 메서드
- 상세: 변경 2.3 으로 `resolveWaitingNodeExecutionId` 가 `__no_node_exec__` sentinel 반환에서 실제 DB SELECT 로 전환되었다. `continueExecution`, `continueButtonClick`, `continueAiConversation`, `endAiConversation` 4개 메서드 호출마다 NodeExecution 테이블에서 `executionId + status='waiting_for_input'` 조건의 쿼리가 추가 발생한다. `select: { id, nodeId, startedAt }` 로 필드가 최소화되고 `order: { startedAt: 'DESC' }` 를 사용하고 있다.
- 제안: `(executionId, status)` 복합 인덱스 또는 `(status, executionId)` 인덱스 존재 여부 확인이 필요하다. 인덱스 없이 대규모 NodeExecution 테이블에서 조회 시 전체 스캔이 발생할 수 있다. 이 쿼리는 sentinel 우회 제거라는 정확성 향상과의 필수 트레이드오프이며, 인덱스가 적절히 설정된 경우 성능 영향은 미미하다.

### [INFO] interaction.service — dispatchContinuation 래퍼로 인한 추가 Promise 생성
- 위치: `codebase/backend/src/modules/external-interaction/interaction.service.ts` L2834-2845
- 상세: `dispatchContinuation(promise)` 는 이미 생성된 Promise 를 인자로 받아 새로운 async wrapper Promise 를 생성한다. 4개 continuation dispatch case 마다 적용되며, 각 호출마다 여분의 microtask queue 진입이 발생한다. V8 에서 Promise 할당은 경량이고 즉시 GC 대상이 되므로 실질 성능 영향은 무시할 수 있는 수준이다.
- 제안: 현행 유지. 코드 가독성과 에러 처리 통일성이라는 이점이 비용을 충분히 상회한다.

### [INFO] websocket.gateway — 4개 handler 에서 instanceof 검사 반복
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts` 각 catch 블록 (L416, L495, L571, L644 근방)
- 상세: `handleSubmitForm`, `handleClickButton`, `handleSubmitMessage`, `handleEndConversation` 4개 handler 각각의 catch 블록에서 `error instanceof InvalidExecutionStateError` 검사와 `errorCode` 추출 로직이 동일하게 반복된다. `instanceof` 체크 비용은 상수 시간으로 무시할 수 있다.
- 제안: 성능 영향 없음. 헬퍼 함수 추출은 중복 제거 관점에서 고려 가능하나 성능 문제는 아니다.

---

## 요약

이번 변경은 DLQ 모니터링 서비스 신설(Phase 3.1)과 sentinel 우회 제거(변경 2.3)로 구성된다. 성능 관점에서 중대한 비효율은 발견되지 않았다. `ContinuationDlqMonitorService` 는 60초 polling interval, `timer.unref()` 적용, Redis 실패 시 삼킴/재시도 패턴으로 적절하게 설계되었다. `resolveWaitingNodeExecutionId` 의 DB lookup 추가는 sentinel 우회 제거의 필수 비용이며, `(executionId, status)` 복합 인덱스 확인만 권장된다. 나머지 변경들은 error handling 경로 개선으로 hot path 와 무관하며 성능 회귀를 유발하지 않는다.

## 위험도

LOW
