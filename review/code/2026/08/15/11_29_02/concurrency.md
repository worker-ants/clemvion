# 동시성(Concurrency) Review — `durationMs` 종결 이벤트 페이로드

## 검토 범위 및 방법

프롬프트가 diff 를 파일별로 잘라 제공했으나, 대상 커밋 범위(`origin/main..HEAD`)에서
`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 및
`retry-turn.service.ts` 의 전체 diff 를 `git diff` 로 직접 재확인해 프롬프트 절단으로
인한 누락이 없는지 확인했다. 그 외 변경 파일(`chat-channel.dispatcher.ts`,
`chat-channel/types.ts`, `terminal-duration.ts`, 각 `*.spec.ts`, 문서류)도 확인했다.

## 발견사항

없음.

이 changeset 은 `execution.completed`/`failed`/`cancelled` payload 에 `durationMs` 를
싣는 순수 계산 로직(`resolveTerminalDurationMs`, `TERMINAL_DURATION_MS_SQL`,
`toFiniteNumber` — `codebase/backend/src/shared/utils/terminal-duration.ts`)을 **기존에
이미 확립돼 있던 동시성 제어 패턴 위에 값만 추가로 얹는 방식**으로 구현했다. 검토한
축은 다음과 같다.

- **경쟁 조건 / 원자성**: raw UPDATE 5경로(`cancelParkedExecution`,
  `markWebChatIdleTimeout`, `markExecutionCancelled`, `markQueueWaitTimeout`,
  `finalizeStalledExhausted` — `execution-engine.service.ts`)는 전부 기존과 동일하게
  `WHERE id = :id AND status = :expected` 조건부 UPDATE + `affected` 검사로 멱등·경합
  안전성을 유지한다. 이번 diff 는 `durationMs: () => TERMINAL_DURATION_MS_SQL` 을
  **같은 UPDATE 문** 안에 추가하고 `RETURNING duration_ms` 로 되받을 뿐, WHERE 가드·
  `affected` 체크·트랜잭션 경계는 건드리지 않았다. `finishedAt` 값도
  `terminalFinishedAt` 상수로 한 번만 생성해 `SET finished_at` 과 SQL 표현식의
  `:terminalFinishedAt` 바인딩에 **동일 인스턴스**를 사용하므로, `SET` 절과 `CASE`
  비교가 서로 다른 `new Date()` 호출로 미세하게 어긋날 여지도 없앴다.
- **트랜잭션**: `cancelParkedExecution`/`markWebChatIdleTimeout` 의
  `this.dataSource.transaction(async (manager) => {...})` 블록 구조는 그대로다.
  블록 안에서 선언된 `let cancelledDurationMs`/`terminalFinishedAt` 는 클로저 캡처이고,
  `await this.dataSource.transaction(...)` 가 완료된 뒤에야 바깥에서 읽으므로
  happens-before 가 보장된다 — 다중 실행 컨텍스트가 동시에 같은 지역 변수를
  갱신할 여지는 없다(Node.js 단일 스레드 + 지역 변수 스코프).
- **QueryBuilder 인스턴스 격리**: `manager.createQueryBuilder()`/
  `this.executionRepository.createQueryBuilder()` 는 호출마다 새 인스턴스이므로,
  새로 추가된 `setParameter(TERMINAL_FINISHED_AT_PARAM, ...)` 가 동시 실행 중인 다른
  요청의 쿼리 파라미터와 공유되거나 충돌할 가능성은 없다.
- **엔티티 로드 경로**(`retry-turn.service.ts`, `execution-engine.service.ts` 의
  `savedExecution.durationMs = resolveTerminalDurationMs(...) ?? ...`): 계산은 메모리
  상의 `startedAt`/`finishedAt` 로 수행되고, 그 결과를 담은 엔티티가 이후
  `updateExecutionStatus`/`finalizeGuarded` (기존의 조건부 원자 UPDATE)로 영속된다.
  가드가 막히면(`affected=0`, 예: 동시 Stop 이 먼저 CANCELLED 로 전이) 함수가 조기
  반환해 emit 자체를 건너뛰므로, 계산된 `durationMs` 가 잘못된 상태 전이에 실려
  나갈 경로가 없다. 이 가드 로직 자체는 이번 diff 의 변경 대상이 아니다(기존 로직
  유지).
- **`resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL`**: 모두
  순수 함수·상수 문자열이며 모듈 레벨 가변 상태가 없다 — 동시 호출 간 공유 자원이
  없어 스레드 세이프성 문제가 원천적으로 발생하지 않는다.
- **async/await 누락 여부**: 변경 diff 전체(`codebase/backend/src` 범위)에서 제거된
  `await` 호출을 grep 으로 전수 확인했고, 삭제된 줄에 `await` 가 포함된 곳은 없었다
  (`git diff origin/main..HEAD -- codebase/backend/src | grep '^-.*await'` → 0건).
- **이벤트 루프 / 리소스 풀링**: 이번 diff 는 동기 산술(`Math.min`, `Date.getTime()`
  뺄셈)과 SQL 표현식 문자열 상수 추가뿐이며, 새로운 타이머·워커·커넥션 풀 설정을
  도입하지 않는다.
- **문서로 남아 있는 기지(既知) 이론적 race**(`finalizeStalledExhausted` JSDoc의
  "stalled 소진 vs `recoverStuckExecutions` 재-claim" 각주, `execution-engine.service.ts`
  주변 라인)는 diff 의 `+` 라인이 아니라 기존 컨텍스트다 — 이번 변경이 만든 것이
  아니고 손대지도 않았다.

CHANGELOG/plan/RESOLUTION.md 등 문서 파일과 `chat-channel.dispatcher.ts`/`types.ts`
변경은 전부 동기 순수 변환 함수·타입 주석·문서 텍스트로, 동시성 표면이 없다.

## 요약

이번 변경은 종결 이벤트 3종에 `durationMs` 를 싣기 위한 계산 로직을 추가한 것으로,
DB 쓰기 동시성의 핵심인 "조건부 원자 UPDATE + affected 체크 + (2단계 갱신 시) 단일
트랜잭션" 패턴을 하나도 건드리지 않고 그 위에 계산된 값만 실었다. 새로운 공유 가변
상태, 락, 프라미스 누락, 트랜잭션 경계 변경이 없으며, raw UPDATE 5경로 모두 기존
WHERE 가드를 유지한 채 같은 SQL 문 안에서 `RETURNING` 으로 값을 되받아 DB 와 emit
페이로드가 동일한 값을 쓰도록 강화했다(오히려 `finishedAt` 이중 `new Date()` 호출로
인한 미세 불일치 가능성을 상수화로 없앴다). 동시성 관점에서 새로 도입된 결함은
없다.

## 위험도

NONE
