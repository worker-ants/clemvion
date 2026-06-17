# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [INFO] retryLastTurn: 트랜잭션 외부 사전 검증과 트랜잭션 내 원자적 소비의 분리 구조
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 116–220행 (`retryLastTurn`)
- 상세: TTL·retryable·retryAfterSec 검증(1–5단계)은 트랜잭션 외부에서 DB 스냅샷을 읽어 수행하고, 실제 소비(JSONB `-` 연산)는 트랜잭션 내부에서 `jsonb_exists` 가드로 원자적으로 수행한다. 외부 검증과 트랜잭션 사이에 다른 요청이 state 를 변경해도 트랜잭션 내 `affected=0` 판정이 중복 spawn 을 차단한다. 이 패턴은 의도적이고 올바르다.
  - `retryAfterSec` 카운트다운 검증은 트랜잭션 외부에서 수행되므로, 경계 시점(정확히 카운트다운이 만료되는 순간)의 두 동시 요청이 모두 통과해 트랜잭션에 도달할 수 있다. 이 경우 한 요청만 `affected=1` 을 받고 spawn 하고, 나머지는 `RETRY_STATE_NOT_FOUND` 로 거부된다. 결과적으로 중복 spawn 은 발생하지 않으나, 에러 코드가 의미론적으로 `RETRY_TOO_EARLY` 대신 `RETRY_STATE_NOT_FOUND` 로 반환되는 불일치가 있다.
- 제안: 허용 가능한 edge case. 에러 메시지("already consumed")가 실제 상황을 적절히 설명하므로 운영상 혼동은 적다. 엄격한 의미론이 필요하면 TTL·retryAfterSec 검증도 트랜잭션 내부(`SELECT ... FOR UPDATE`)로 이동해야 하나, 이는 성능 비용이 있고 현 spec 요건을 초과한다.

### [INFO] applyRetryLastTurn: 멱등성 체크와 실제 처리 사이의 TOCTOU 창
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-split/codebase/backend/src/modules/execution-engine/retry-turn.service.ts` 265–412행 (`applyRetryLastTurn`), 279행
- 상세: `spawnedRow.status !== NodeExecutionStatus.RUNNING` 멱등성 체크는 DB 에서 row 를 읽은 시점의 스냅샷에 근거한다. BullMQ 재시도(job retry) 등으로 두 worker 가 동일 job 을 동시 처리하는 극단적 상황에서, 두 worker 가 모두 RUNNING 상태를 읽어 멱등성 체크를 통과한 뒤 `rehydrateContext` → `processAiResumeTurn` 을 동시 실행할 수 있다. 그러나 (a) BullMQ 의 기본 job 처리 의미론은 단일 consumer 보장이고, (b) `finalizeAiNode` 내 `updateExecutionStatus` 가 guarded UPDATE(M-3)로 terminal emit 을 한 번만 허용한다. 즉 하위 레이어에 추가 guard 가 있어 최악의 경우에도 중복 COMPLETED 이벤트는 발생하지 않는다.
- 제안: 현 아키텍처(BullMQ 단일 consumer + M-3 guard) 에서는 허용 범위 내. 추가 방어가 필요하다면 `spawnedRow` 조회 후 `SELECT ... FOR UPDATE SKIP LOCKED` 패턴을 적용할 수 있으나 현재 설계 수준에서 필수가 아니다.

### [INFO] applyRetryLastTurn: finally 블록의 contextService.deleteContext 와 PARK_RELEASED 분기
- 위치: `retry-turn.service.ts` 397–411행 (`applyRetryLastTurn` try/finally)
- 상세: `turnSignal === PARK_RELEASED` 로 조기 return 하는 경우(대화 계속 — re-park)에도 `finally` 블록이 실행돼 `contextService.deleteContext(executionId)` 가 호출된다. 이 context 는 re-park 이후 다음 continuation 이 `rehydrateContext` 로 재사용할 in-memory context 다. deleteContext 가 다음 turn 의 rehydration 을 방해하지 않는지가 핵심이다.
  - `rehydrateContext` 가 in-memory context 를 찾지 못하면 DB 에서 재구성하는 경로(`_resumeCheckpoint` / conversation_thread)를 탄다. 이 경우 삭제는 in-memory 캐시 무효화로 작동해 다음 worker 인스턴스(또는 재시작 후)에서 DB 재구성 경로로 자연스럽게 처리된다.
- 제안: 기능 정확성에 문제는 없다. `deleteContext` 가 항상 호출되는 이유(메모리 누수 방지)가 명확히 문서화돼 있으므로 현 코드는 적절하다.

### [INFO] `spawned` 변수 closure 캡처 패턴
- 위치: `retry-turn.service.ts` 190–228행
- 상세: `let spawned: NodeExecution | null = null` 을 트랜잭션 콜백 외부에 선언하고 콜백 내에서 할당하는 패턴은 TypeScript/Node.js 단일 스레드 모델에서 정상 동작한다. 트랜잭션 콜백이 완료(resolved) 된 후 외부에서 `spawned` 를 읽으므로 경쟁 조건 없음.
- 제안: 이상 없음. 기존 엔진 코드에서 그대로 이관된 패턴이므로 일관성도 유지된다.

## 요약

이번 변경(RetryTurnService 추출, C-1 step4)은 god-class 에서 retry lifecycle 을 분리한 구조 리팩터링이다. 동시성 핵심 메커니즘인 atomic consume(`_retryState` JSONB `-` 연산 + `jsonb_exists` guard, `affected` 판정, 단일 트랜잭션 내 spawn)은 기존 코드에서 verbatim 이관됐으며 올바르게 구현돼 있다. 동시 retry 중복 spawn, zombie row 방지(RUNNING 잔류 방지), 멱등성(RUNNING 아닌 row discard) 모두 기존 수준을 그대로 보존한다. 신규 관점에서의 동시성 버그는 발견되지 않았다. INFO 수준으로 기록한 세 항목은 의도된 설계 트레이드오프(트랜잭션 외부 사전 검증, PARK_RELEASED 후 context 삭제, TOCTOU 창)이며 현 아키텍처 제약(BullMQ 단일 consumer, M-3 guarded UPDATE) 에서 안전하다.

## 위험도

LOW
