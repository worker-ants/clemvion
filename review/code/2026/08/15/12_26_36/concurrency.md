# 동시성(Concurrency) 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들에서 크기 제한으로 diff 가 생략된 파일(`execution-engine.service.ts`,
`execution-engine.service.spec.ts`, `retry-turn.service.spec.ts` 일부,
`terminal-duration.ts`/`.spec.ts`)은 `Read`/`Bash grep`으로 저장소를 직접 열어 대조했다.
이 changeset 은 이미 다섯 라운드(`09_58_24`~`11_09_44`)의 리뷰를 거쳤고, `11_09_44` 가
이 changeset 에 대한 첫 동시성 전용 패스로 WARNING 2건(risk MEDIUM)을 남긴 이력이 있다.
이번 라운드(`12_26_36`)의 목적은 그 두 건이 이후 커밋(`2c9b490fd`~`ef1ed21d7`, JS int4
클램프·vacuous mock·dashboard 집계 수정 등)으로 해소됐는지, 그리고 새 회귀가 없는지
재확인하는 것이다. 결론: **두 건 모두 아직 코드에 그대로 남아 있고**, 둘 다
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 등재·유예 근거가
기재돼 있음을 확인했다.

## 발견사항

- **[WARNING]** 재진입 레이스에서 emit 되는 `durationMs` 가 실제로 영속된 DB 값과 다를 수 있다 — `finalizeCancelledExecution` (기존 결함, 이번 라운드에도 미해소 확인)
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4876-4891`
    (`4883-4884` 로컬 계산·대입, `4885` guarded UPDATE 호출, `4886-4890` 반환값 미확인
    always-emit)
  - 상세: `finalizeCancelledExecution` 은 `updateExecutionStatus(savedExecution, CANCELLED)`
    가 guarded UPDATE(else 분기, `execution-engine.service.ts:8609-8640` — `WHERE status IN
    (non-terminal)`)로 0행 매칭돼도(이미 다른 요청, 예: 사용자의 `stop()` 이 먼저 CANCELLED
    를 커밋한 경우) **반환값(boolean)을 확인하지 않고 무조건 `emitCancellationEvent` 를
    호출한다**(JSDoc 4869 "emit 은 반환값과 무관하게 항상 발행한다" — 의도된 설계). 문제는
    `durationMs: resolveTerminalDurationMs(savedExecution)`(4888)가 **이 catch 가 로컬로
    계산한, DB 에 반영되지 않았을 수 있는 값**(`finishedAt` 은 이 catch 도달 시각 T2)이라는
    점이다. `updateExecutionStatus` 의 guarded UPDATE(8614-8625)는 `RETURNING id` 만 돌려주고
    실제로 어떤 `duration_ms` 값이 그 순간 행에 들어 있는지(먼저 커밋된 T1인지, 이번 시도의
    값인지)를 호출자에게 알려주지 않는다. 결과적으로 동시 `stop()` 요청과 경합하는 좁은 창에서
    wire 로 나가는 `durationMs`(T2)가 그 순간 DB 실제 값(T1, 대개 더 짧음)과 어긋난다 — 같은
    PR 이 raw-UPDATE 5경로(`cancelParkedExecution`/`markWebChatIdleTimeout`/
    `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`)에서
    `RETURNING duration_ms` 로 명시적으로 피한 "DB 와 wire 가 다른 값을 쓰는" 결함 클래스가
    이 두 곳에는 남아 있다.
  - 제안: `updateExecutionStatus`(또는 그 내부 else 분기 raw UPDATE)에
    `RETURNING duration_ms, finished_at` 을 추가해 실제 영속값을 호출자에게 돌려주고
    `emitCancellationEvent` 에는 그 반환값을 싣는다. **이미 트래커에 등재돼 있다** —
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` §"retry turn 재진입 시 DB
    와 emit 의 durationMs 가 어긋난다"(2026-08-15 등재, `10_34_51` W1 / `11_09_44` concurrency
    W1 병합) — "근본 원인은 `updateExecutionStatus` 가 `RETURNING` 없이 boolean 만 돌려주는
    것 — 둘을 함께 고쳐야 한다"고 명시. 이번 라운드가 즉시 고치지 않은 근거(DB write 경로를
    또 바꾸는 변경이라 서두르면 과잉 스코프를 반복한다)도 문서화돼 있어 **유예 자체는
    타당**하나, 실측 결과 여전히 열려 있다는 점을 재확인해 둔다.

- **[WARNING]** 같은 레이스 클래스가 `retry-turn.service.ts` 의 CANCELLED 재진입 분기에도 존재한다 (기존 결함, 이번 라운드에도 미해소 확인)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:637-651`
    (`finalizeGuarded` 의 COALESCE 분기), `:947-949`(`failRetryExecution` 대입),
    `:971`(emit `durationMs: resolveTerminalDurationMs(execution)`); 동형 경로
    `:894-909`(`completeRetryExecution`, COMPLETED 대상이라 COALESCE 분기는 안 타지만 동일하게
    `finalizeGuarded` 반환 boolean 만 확인하고 로컬 계산값을 emit)
  - 상세: `finalizeGuarded` 는 이미 CANCELLED 인 행에 재진입할 때 `durationMs: () =>
    'COALESCE(duration_ms, :newDurationMs)'`(`:643`)로 **DB 에 이미 있는 값(먼저 커밋된
    `stop()` 의 T1)을 의도적으로 보존**한다(`:619-636` 주석이 §2.3 계약 근거를 명시). 그런데
    이 COALESCE UPDATE(`:638-650`)도 `RETURNING` 없이 `affected` 만 확인해 boolean 을
    반환하므로, 실제로 어느 값이 채택됐는지(T1 보존 vs T2 신규 기록)를 호출자에게 알려주지
    않는다. `failRetryExecution`(`:971`)은 `finalizeGuarded` 가 `true` 를 반환하면(COALESCE
    로 T1 이 보존된 경우도 포함) **로컬 `execution` 객체(이번 시도의 T2)** 를 그대로
    `resolveTerminalDurationMs` 에 넣어 emit — COALESCE 가 T1 을 보존한 케이스라면 DB 는 T1,
    emit 은 T2 로 갈린다. "희귀 레이스" 가 아니라 "retry-turn 처리 중 Stop" 이라는 일반
    흐름에서 결정적으로 발생한다(`plan` 문서 표현 그대로).
  - 제안: 위와 동일 — COALESCE UPDATE 에 `.returning(['duration_ms'])` 를 추가해 실제 영속값을
    되받아 emit. **트래커 등재 확인**: 같은 절(`spec-sync-external-interaction-api-gaps.md`
    §"retry-turn 재진입…")에 `[ ] CANCELLED 분기에 .returning(['duration_ms']) 추가 → 실제
    persist 값을 되읽어 emit 전 갱신` 으로 명시돼 있다.

- **[INFO]** 그 외 14개 종결 경로는 이 PR 이 새 레이스·데드락을 도입하지 않았다
  - 상세: `cancelParkedExecution`/`markWebChatIdleTimeout`(`execution-engine.service.ts:1023-1225`,
    `:1152-1225`)는 `dataSource.transaction` 내에서 Execution UPDATE(RETURNING)와 짝
    NodeExecution UPDATE 를 원자적으로 묶고, `markExecutionCancelled`/`markQueueWaitTimeout`/
    `finalizeStalledExhausted`(`:2810-2878`, `:2886-2925`, `:3334-3400`)는 단일 UPDATE 문
    안에서 `TERMINAL_DURATION_MS_SQL` 로 계산하고 `RETURNING` 으로 되받아 emit 에 싣는다 —
    "계산 후 별도 왕복으로 쓰기" 보다 레이스 창을 줄이는 견고한 설계다. 상태 전이 가드
    (`WHERE status = ...`/`IN (...)`, affected-count 확인 후에만 emit)는 이 PR 이전부터 있던
    낙관적 동시성 제어이며 변경되지 않았다. 트랜잭션은 각각 단일 UPDATE 세트만 감싸 다중 락
    순서로 인한 데드락 표면을 새로 만들지 않는다.
  - `finalizeStalledExhausted` 는 Execution UPDATE(트랜잭션 안)와 자식 NodeExecution cascade
    UPDATE(트랜잭션 밖, `:3373-3389`)가 별개 문장이라 크래시 시 불일치 여지가 있으나, 이는
    이 PR 이전부터 있던 구조(`durationMs`/`RETURNING` 필드만 추가됐을 뿐 트랜잭션 경계는
    diff 밖)라 이번 변경이 유발한 회귀가 아니다.
  - 제안: 없음(정보 제공 목적).

- **[INFO]** `resolveTerminalDurationMs`/`toFiniteNumber`/`TERMINAL_DURATION_MS_SQL` 자체는 공유 가변 상태가 없다
  - 상세: `codebase/backend/src/shared/utils/terminal-duration.ts` 전체를 열어 확인 — 순수
    함수(인자 → 반환값, 클로저/모듈 레벨 mutable 상태 없음)와 불변 모듈 상수뿐이다. Node.js
    단일 이벤트 루프 + 불변 값 조합이라 여러 요청이 동시에 호출해도 스레드 세이프 문제가 없다.
    `await` 누락, 블로킹 I/O, 커넥션/스레드 풀 크기 변경은 발견되지 않았다. `dashboard.service.ts`
    /`statistics.service.ts` 의 SQL 필터 추가(`e.status = :completedStatus`)도 단일 쿼리 내
    조건절 추가일 뿐 동시성 표면이 없다.

## 요약

이 PR 은 종결 이벤트 16개 emit 경로에 `durationMs` 를 배관하면서, 대부분(엔티티 미로드 raw
UPDATE 5경로 + 짝 NodeExecution 트랜잭션 2곳)은 같은 UPDATE 문 안에서 SQL 로 계산하고
`RETURNING` 으로 되받는 견고한 설계를 택해 기존 낙관적 동시성 제어를 훼손하지 않았다. 다만 두
곳(`execution-engine.service.ts` 의 `finalizeCancelledExecution`, `retry-turn.service.ts` 의
`failRetryExecution`/`completeRetryExecution`)은 상태 전이의 단일 choke point
(`updateExecutionStatus`/`finalizeGuarded`)가 `RETURNING` 없이 boolean 만 반환하는 기존
구조 위에 새 `durationMs` emit 을 얹어, 동시 `stop()` 요청과 경합하는 좁은 레이스 창에서
emit 값이 실제 DB 값과 달라질 수 있다. 이 두 건은 이미 `11_09_44` 라운드의 독립 동시성
패스가 정확히 같은 두 지점을 찾아 WARNING/risk MEDIUM 으로 기록했고, 이후 다섯 커밋
(`2c9b490fd`~`ef1ed21d7`)이 다른 결함(JS int4 클램프·vacuous mock·dashboard 집계)을
고치는 동안 이 레이스는 손대지 않았다 — 실측 결과 여전히 열려 있다. 두 지점 모두
`plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 처방(`RETURNING` 추가)과
유예 근거("DB write 경로를 또 바꾸는 변경이라 서두르면 과잉 스코프를 반복한다")가 함께
등재돼 있어, 이번 라운드가 즉시 고치지 않는 것 자체는 정당한 절차를 따른 것으로 판단한다.
크래시·락업·데이터 유실(DB 자체는 COALESCE/가드로 항상 안전)은 없고 영향은 부가 필드
(`durationMs`) 값 하나에 국한되며, REST 재조회 경로(`GET /api/external/executions/:id`)에는
아직 노출되지 않아(별도 트래킹 중, W4/W5) 블라스트 반경은 제한적이다. 데드락·스레드 안전성·
async/await 누락·리소스 풀링 관점에서는 새로 도입된 문제가 없다.

## 위험도

MEDIUM
