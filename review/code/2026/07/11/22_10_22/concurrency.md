# 동시성(Concurrency) Review

대상: `refactor-reaper-dry` — behavior-preserving DRY 리팩터. 핵심 변경은 (1) `common/utils/process-in-batches.ts`
신설(bounded-concurrency 청크 헬퍼, 2곳 중복 루프 통합), (2) `ExecutionEngineService.emitCancellationEvent` private
헬퍼 신설(4개 cancel 메서드의 `try{emit}catch{warn}` 보일러플레이트 통합), (3) `Webchat`→`WebChat` 식별자 rename(순수
문자열 치환, 계약 표면 무변경). plan(`plan/in-progress/refactor-reaper-dry.md`)에 "동작 무변경" 이 명시 목표.

## 발견사항

- **[INFO]** `processInBatches` 는 청크 경계에서 배리어(barrier)를 형성한다 — 다음 청크는 이전 청크의 **모든**
  워커가 settle 된 뒤에만 시작된다(슬라이딩 윈도우 방식의 세마포어가 아님).
  - 위치: `codebase/backend/src/common/utils/process-in-batches.ts:207-211`
  - 상세: `for (i += chunkSize) { await Promise.allSettled(chunk.map(worker)) }` 구조상, 청크 내 한 아이템이
    유독 느리면(예: 특정 execution 의 DB round-trip 지연) 그 청크의 다른 슬롯이 비어 있어도 다음 청크가
    시작되지 않아 처리량이 저하될 수 있다. 다만 이는 **리팩터 이전 두 호출처(`interaction-token.service.ts`
    `reconcileTerminalRevocations`, `webchat-idle-reaper.service.ts` `reap`)가 이미 갖고 있던 동일 패턴**을
    그대로 추출한 것이라 회귀가 아니다. JSDoc 도 "awaiting each chunk before starting the next" 로 이 특성을
    명시하고 있어 의도된 trade-off(구현 단순성 vs 최적 처리량)로 보인다.
  - 제안: 조치 불요. 향후 처리 대상 규모가 커지고 개별 아이템 지연 편차가 커지면 `p-limit` 류 진짜 슬라이딩
    윈도우 세마포어로 교체를 고려할 수 있다는 정도만 백로그 인지.

- **[INFO]** `processInBatches` 순서 보존·집계 정합성 — 청크 통합 후에도 호출처의 `results[idx] ↔ items[idx]`
  매핑이 정확히 유지된다.
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:782-795`,
    `codebase/backend/src/modules/external-interaction/webchat-idle-reaper.service.ts:1667-1682` (구 diff 기준,
    최종 파일 `webchat-idle-reaper.service.ts:1787-1802`)
  - 상세: 청크가 순차적으로 `results` 배열에 `push(...settled)` 되고, 청크 내부는 `chunk.map()` 으로 입력 순서를
    보존하는 `Promise.allSettled` 를 쓰므로, 전체 `results` 는 원본 `items`/`rows`/`executionIds` 와 인덱스가
    1:1 대응한다. 두 호출처 모두 리팩터 후 `rows[idx]`/`executionIds[idx]` 로 warn 로그를 남기는데, 검증 결과
    누락·인덱스 밀림 없음. `concurrency<=0` 입력 시 `Math.max(1, Math.floor(concurrency))` 로 1(직렬)에 floor 되어
    무한 루프(구 코드라면 `i += 0` 로 무한 루프 가능성)를 원천 차단 — 오히려 방어가 강화됐다.

- **[INFO]** `emitCancellationEvent` 추출이 await 체인을 그대로 보존 — 4개 cancel 경로 모두 fire-and-forget
  으로 퇴화하지 않았다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:397-422` (헬퍼 정의),
    호출부 `:376-379`(`cancelParkedExecution`), `:463-467`(`markWebChatIdleTimeout`),
    `:502-506`(`markExecutionCancelled`), `:532-536`(`markQueueWaitTimeout`)
  - 상세: 4곳 모두 `await this.emitCancellationEvent(...)` 로 호출하며, 헬퍼 내부도 `try { await
    this.eventEmitter.emitExecution(...) } catch (emitErr) { this.logger.warn(...) }` 로 원래 각 호출처의
    try/catch 를 그대로 이전했다. emit 실패가 catch 되어 warn 으로 흡수되고 rethrow 되지 않으므로, DB
    commit(cancel) 이후 best-effort emit 이라는 기존 계약(각 메서드 JSDoc 이 명시)이 그대로 유지된다. 헬퍼
    호출 뒤에 이어지는 동기 호출(예: `markQueueWaitTimeout` 의 `this.eventEmitter.releaseExecutionRouting(...)`,
    execution-engine.service.ts:537)도 순서가 그대로 보존된다.

- **[INFO]** `Webchat` → `WebChat` 식별자 rename 은 큐 이름 문자열(`webchat-idle-reaper`)·env 키
  (`WEBCHAT_IDLE_REAP_*`)·wire 값(`WEBCHAT_IDLE_TIMEOUT`)을 건드리지 않는 순수 타입/클래스명 치환이라, BullMQ
  `upsertJobScheduler` 의 scheduler ID·`@Processor` 큐 바인딩·멀티 인스턴스 조정(Redis 단일 entry) 등 동시성에
  관여하는 문자열 표면은 변경되지 않았다. `@Processor(WEBCHAT_IDLE_REAPER_QUEUE, { concurrency: 1 })` (큐 레벨
  직렬화) 와 `REAP_CONCURRENCY`(10)/`RECONCILE_CONCURRENCY`(20) 상수값도 리팩터 대상 밖으로 그대로다.

- 신규 이슈 없음. `markWebChatIdleTimeout`/`markQueueWaitTimeout`/`markExecutionCancelled` 의 조건부 UPDATE
  기반 원자적 상태 전이(WAITING_FOR_INPUT 가드, `affected` 체크로 중복 emit 회피)는 diff 범위 밖 — 이번 변경은
  그 가드 로직 자체를 건드리지 않고 emit 보일러플레이트만 추출했다.

## 요약

이번 변경은 두 개의 bounded-concurrency sweep(terminal-revoke reconcile, webchat idle reaper)이 공유하던
`for(chunk){await allSettled}` 루프를 `processInBatches` 유틸로, 4개 cancel 경로가 공유하던
`try{emit}catch{warn}` 을 `emitCancellationEvent` 헬퍼로 각각 추출한 순수 구조 리팩터다. 두 추출 모두 순서·await
체인·집계 로직·동시성 상한(REAP_CONCURRENCY=10, RECONCILE_CONCURRENCY=20)을 원본과 동일하게 보존했고, 신규
방어(`concurrency<=0` floor)가 오히려 강화됐다. `Webchat`→`WebChat` rename 은 큐/env/wire 문자열을 건드리지 않아
멀티 인스턴스 조정 표면에 영향이 없다. 새로운 경쟁 조건·데드락·await 누락·원자성 붕괴는 발견되지 않았으며, 유일한
주목점(청크 배리어로 인한 처리량 특성)은 리팩터 이전부터 존재하던 by-design 동작이라 회귀가 아니다.

## 위험도

LOW
