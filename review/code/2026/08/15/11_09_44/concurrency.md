# 동시성(Concurrency) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들에서 크기 제한으로 diff 가 생략된 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `plan/in-progress/eia-terminal-payload.md`,
`spec-sync-external-interaction-api-gaps.md`)은 `git diff origin/main --`  와 `Read` 로
직접 열어 대조했다. 리뷰 초점은 종결 이벤트(`completed`/`failed`/`cancelled`) 16개 emit 경로가
공유하는 guarded UPDATE(조건부 `WHERE status = ...`, 낙관적 동시성 제어) 패턴에 이번 PR 이
`durationMs` 계산·emit 을 끼워 넣으면서 기존 레이스 가드를 깨거나 새 비원자성을 만들었는지였다.
이 changeset 에는 이전 라운드(`09_58_24`/`10_18_38`/`10_34_51`/`10_52_08`)에 `concurrency.md`
산출물이 없어 이번이 이 changeset 에 대한 첫 동시성 전용 패스다.

## 발견사항

- **[WARNING]** 재진입 레이스에서 emit 되는 `durationMs` 가 실제로 영속된 DB 값과 다를 수 있다 —
  `finalizeCancelledExecution`
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4878-4888`
    (특히 `4882` 대입, `4886` emit)
  - 상세: 이 헬퍼는 `updateExecutionStatus(savedExecution, CANCELLED)` 가 **가드 실패해도
    (0행, 이미 terminal) 무조건 emit 을 발행한다** — 이는 이 PR 이전부터 있던 설계로, JSDoc(4867-4869)이
    "stop() 이 RUNNING/PENDING 경로에서는 이벤트를 쏘지 않아 이 헬퍼가 유일한 알림 지점일 수
    있다"고 명시한다. `updateExecutionStatus`(8503, else 분기 8620 부근)는 `RETURNING id` 만
    돌려주고 실제로 영속된 `duration_ms`/`finished_at` 을 호출자에게 되돌려주지 않는다(boolean
    `persisted` 만). 따라서 동시에 다른 요청(예: 사용자의 `stop()`)이 먼저 CANCELLED 를 커밋해
    이 UPDATE 가 0행 매칭되면, `savedExecution.durationMs`(이 catch 가 로컬로 계산한, **영속되지
    않은** 값 — `finishedAt` 은 이 catch 의 시각 T2)가 그대로 `emitCancellationEvent` 로 나간다.
    반면 DB 에는 먼저 커밋한 요청의 `duration_ms`(T1 기준, 보통 더 짧음)가 들어 있다. 결과적으로
    **wire 로 나가는 `durationMs` 가 그 순간 DB 에 실제로 저장된 값과 어긋난다** — 이 PR 이
    `terminal-duration.ts` JSDoc·`finalizeStalledExhausted`(RETURNING 으로 값을 되받아 emit)에서
    명시적으로 피하려던 바로 그 "DB 와 wire 가 다른 값을 쓰는" 결함 클래스다.
  - 제안: `updateExecutionStatus`(또는 그 내부 raw UPDATE)에 `RETURNING duration_ms, finished_at`
    을 추가해 실제 영속값을 호출자에게 돌려주고, `emitCancellationEvent` 에는 그 반환값을 싣는다
    (가드 실패 시엔 별도로 현재 행을 다시 읽어 진짜 값을 emit 하거나, 최소한 "추정치일 수 있다"는
    것을 인지하고 문제를 트래커에 등재).

- **[WARNING]** 같은 레이스 클래스가 `failRetryExecution` 의 CANCELLED 재진입 분기에도 존재한다
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:947-949`(대입),
    `:971`(emit `durationMs: resolveTerminalDurationMs(execution)`), 상호작용 대상은
    `finalizeGuarded` 의 COALESCE 분기 `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:637-651`
    (이번 diff 로 변경된 줄은 아니지만 신규 emit 이 이 분기와 상호작용해 문제를 만든다)
  - 상세: `finalizeGuarded` 는 이미 CANCELLED 인 행에 재진입할 때 의도적으로
    `durationMs: () => 'COALESCE(duration_ms, :newDurationMs)'` 로 **DB 에 이미 있는 값(먼저
    커밋된 `stop()` 의 T1 값)을 보존**하고 이번 시도의 값을 버린다 — 주석(619-636)이 이유를
    명시한다("`stop()` 이 커밋한 finishedAt/durationMs 가 보존된다"는 §2.3 계약을 지키기 위함).
    그런데 이 COALESCE UPDATE 도 실제로 어느 값이 채택됐는지(보존된 T1 인지, 이번 시도의 값인지)를
    호출자에게 돌려주지 않는다(`RETURNING` 없이 `affected` 만 확인). 이 PR 이 새로 추가한
    `failRetryExecution` 의 emit(`:971`)은 `finalizeGuarded` 가 `true` 를 반환하면(COALESCE 로
    보존이든 신규 기록이든 구분 없이) **로컬 `execution` 객체(이번 시도의 T2 값)** 를 그대로
    `resolveTerminalDurationMs` 에 넣어 emit 한다. COALESCE 가 T1(먼저 커밋된 값)을 보존한
    케이스라면, DB 는 T1 을 갖고 있는데 emit 은 T2 기반 값을 내보내 두 값이 갈린다.
  - 제안: 위 항목과 동일 — COALESCE UPDATE 에 `RETURNING duration_ms` 를 추가해 "그 순간 실제로
    DB 에 적힌 값"을 되받아 emit 에 쓴다.

- **[INFO]** 그 외 14개 종결 경로(guarded conditional UPDATE, raw UPDATE+`RETURNING`, 트랜잭션
  래핑)는 이번 PR 이 만든 새 레이스나 데드락을 도입하지 않았다
  - 상세: `cancelParkedExecution`/`markWebChatIdleTimeout`(트랜잭션 내 단일 UPDATE+`RETURNING`),
    `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`(단일 문장
    UPDATE+`RETURNING`)는 전부 `durationMs` 계산을 **같은 UPDATE 문장 안에서 SQL 로 수행**하고
    `RETURNING` 으로 되받아 emit 에 싣는다 — 오히려 "계산 후 별도 왕복으로 쓰기" 보다 레이스 창을
    줄이는 방향이다. 상태 전이 가드(`WHERE status = ...`, affected-count 확인 후에만 emit)는
    이 PR 이전부터 있던 낙관적 동시성 제어이며 변경되지 않았다. `finalizeStalledExhausted` 의
    JSDoc(3320-3330)이 자인하는 narrow zombie-double-drive 레이스는 이 PR 이전부터 있던 것으로
    명시돼 있고 이 PR 이 확대하지 않는다. 트랜잭션은 각각 단일 UPDATE 문만 감싸므로 다중 락 순서
    문제(데드락)를 새로 만들지 않는다.
  - 제안: 없음(정보 제공 목적).

- **[INFO]** `resolveTerminalDurationMs` 는 순수 함수(공유 가변 상태·I/O 없음)이고, 새 SQL 상수
  `TERMINAL_DURATION_MS_SQL`/`TERMINAL_FINISHED_AT_PARAM` 은 불변 모듈 상수라 여러 요청이
  동시에 참조해도 스레드 세이프 문제가 없다(Node.js 단일 이벤트 루프 + 불변 값). `await` 누락,
  블로킹 I/O 추가, 커넥션/스레드 풀 크기 변경은 발견되지 않았다.

## 요약

이 PR 은 종결 이벤트 16개 emit 경로에 `durationMs` 를 배관하면서, 대부분의 경로(엔티티 미로드
raw UPDATE 5곳)는 계산을 같은 UPDATE 문 안에 SQL 로 넣고 `RETURNING` 으로 되받는 견고한 설계를
택해 기존 낙관적 동시성 제어(guarded UPDATE)를 훼손하지 않았다. 다만 두 곳
(`execution-engine.service.ts` 의 `finalizeCancelledExecution`, `retry-turn.service.ts` 의
`failRetryExecution` CANCELLED 재진입 분기)은 guarded UPDATE 가 `RETURNING` 없이 boolean 성공
여부만 반환하는 기존 구조 위에 새 `durationMs` emit 을 얹었다 — 그 결과 동시 `stop()` 요청과
경합하는 좁은 레이스 창에서, emit 되는 값이 실제로 DB 에 커밋된(혹은 COALESCE 로 보존된) 값과
달라질 수 있다. 이는 이 PR 자신이 다른 경로에서 명시적으로 피하려 했던 "DB 와 wire 가 다른 값을
쓰는" 결함 클래스가 두 곳에 남아 있다는 뜻이다. 크래시·락업·데이터 유실은 없고 영향은 부가 필드
(`durationMs`) 값 하나에 국한되며 REST 재조회 경로에는 아직 노출되지 않아(별도 트래킹 중) 블라스트
반경은 제한적이지만, 정확성 위반이며 두 지점에 동일 패턴으로 재발했다.

## 위험도

MEDIUM
