# 성능(Performance) 리뷰 결과

## 발견사항

- **[INFO]** `processInBatches` 는 barrier(고정 청크) 방식 동시성 — 진짜 sliding-window(세마포어)가 아님
  - 위치: `codebase/backend/src/common/utils/process-in-batches.ts:197-210`
  - 상세: `for (i += chunkSize) { chunk = slice; await Promise.allSettled(chunk.map(worker)) }` 는 한 청크의 `concurrency`개 worker 가 **모두** 끝나야 다음 청크를 시작한다. 청크 내 한 item 이 tail-latency 를 가지면 이미 끝난 나머지 슬롯이 다음 청크 시작 전까지 유휴 상태로 낭비된다(진짜 세마포어 기반이라면 슬롯이 비는 즉시 다음 item 을 투입). 다만 이는 리팩터 이전부터 두 호출부(`webchat-idle-reaper.service.reap`, `interaction-token.service.reconcileTerminalRevocations`)에 각각 존재하던 동일 패턴을 그대로 추출한 것 — plan(`plan/in-progress/refactor-reaper-dry.md`)이 명시한 "동작 무변경(behavior-preserving)" 의도와 일치하며 이번 diff 로 인한 회귀는 아니다.
  - 제안: 현재 두 호출부(Redis SET 기반 revoke, 조건부 DB UPDATE)는 개별 latency 가 비교적 균일해 실무 영향은 미미하다. 다만 이 유틸이 공용으로 승격되어 향후 재사용처(특히 latency 편차가 큰 외부 API 호출 등)가 늘어날 가능성이 있으므로, JSDoc 에 "barrier 방식이지 sliding-window 아님"을 명시해 오용을 예방하거나, 필요 시 세마포어 기반 구현으로 업그레이드를 고려할 가치가 있다.

- **[INFO]** `emitCancellationEvent` 헬퍼 추출 — 성능 중립
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:394-419`
  - 상세: 4개 호출부(`cancelParkedExecution`·`markExecutionCancelled`·`markQueueWaitTimeout`·`markWebChatIdleTimeout`)의 `try{emit}catch{warn}` 보일러플레이트를 단일 private 메서드로 통합. 순수 함수 추출이며 emit 호출 순서·payload·에러 흡수 방식이 동일하게 보존되어 알고리즘 복잡도·I/O 패턴·메모리 사용량에 변화가 없다.

- **[INFO]** naming-only rename (`Webchat` → `WebChat`) — 성능 영향 없음
  - 위치: 다수 파일(`execution-engine.service.ts`, `interaction-token.service.ts`, `webchat-idle-reaper.service.ts`, `webchat-idle-reaper.types.ts`, `external-interaction.module.ts` 등)
  - 상세: 클래스/메서드/함수 식별자·로그 메시지·주석의 대소문자 정규화(c→C)이며 큐 문자열(`webchat-idle-reaper`)·env 키(`WEBCHAT_IDLE_REAP_*`)·wire 값(`WEBCHAT_IDLE_TIMEOUT`)·SQL 쿼리·인덱스는 전부 불변으로 명시(plan 문서 확인). 런타임 동작·쿼리 계획에 영향 없음.

- **[INFO]** `verify()` 결과 캐스트 제거 — 타입 레벨 변경, 런타임 무영향
  - 위치: `codebase/backend/src/modules/external-interaction/interaction-token.service.ts:752-756`
  - 상세: `payload = verify(...) as {...}` → `payload = verify(...)` (변수 `payload` 가 이미 `let payload: { sub?: unknown; aud?: unknown; jti?: unknown }` 로 선언돼 있어 캐스트가 중복이었음). 컴파일 타임 정리로 실행 성능과 무관.

이번 diff 범위에서 새로 도입된 N+1 쿼리/호출, 불필요한 O(n²) 연산, 캐싱 누락, 블로킹 I/O, 메모리 누수 가능성은 발견되지 않았다. `RECONCILE_CONCURRENCY`(20)·`REAP_CONCURRENCY`(10)·batch limit(500/1000) 등 기존 동시성·상한 상수도 모두 그대로 유지된다.

## 요약

이번 변경은 동작 보존을 명시한 순수 DRY 리팩터(청크 동시성 루프 → `processInBatches` 통합, emit try/catch → `emitCancellationEvent` 통합)와 대규모 식별자 rename(`Webchat`→`WebChat`) + 문서 동기화로 구성되며, 알고리즘 복잡도·쿼리 패턴·메모리 사용량·동시성 상한이 리팩터 전과 완전히 동일하게 보존된다. 새로 추출된 `processInBatches` 는 두 호출부에 흩어져 있던 bounded-concurrency 루프를 그대로 옮긴 것이라 신규 성능 이슈를 도입하지 않으며, 오히려 향후 유사 sweep 워커 추가 시 concurrency 가드를 빠뜨리는 실수(무제한 N+1 fan-out)를 줄이는 긍정적 효과가 기대된다. 유일하게 주목할 특성은 barrier 방식 청크가 진짜 세마포어 기반 sliding-window만큼 처리량 최적은 아니라는 점인데, 이는 리팩터 이전부터 존재하던 pre-existing 특성이고 현재 호출부의 워크로드(Redis SET, DB 조건부 UPDATE)에서는 영향이 미미하다.

## 위험도

NONE
