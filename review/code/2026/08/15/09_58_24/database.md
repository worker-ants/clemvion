# 데이터베이스(Database) 코드 리뷰

## 검토 대상 요약

이번 변경(`durationMs` 종결 3종 emit 확장)의 DB 관련 핵심은
`codebase/backend/src/shared/utils/terminal-duration.ts` 가 정의한 `TERMINAL_DURATION_MS_SQL`
(raw SQL 식)과, 이를 `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
의 5개 raw UPDATE 지점(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·
`markQueueWaitTimeout`·`finalizeStalledExhausted`)에 `.set({ durationMs: () => ... })` +
`.setParameter(...)` + `.returning(['id', 'duration_ms'])` 형태로 배선한 것이다. 신규 마이그레이션·
신규 컬럼은 없다(기존 `duration_ms` 컬럼에 값만 채움).

## 발견사항

- **[WARNING]** `duration_ms` 컬럼(`INTEGER`/int4, 최대 ≈24.8일)에 대한 SQL 계산 오버플로가
  cancel/fail 5개 raw UPDATE 경로에 신규로 생겼다 — 초과 시 UPDATE 문 자체가 실패해 취소/실패
  마킹 전체가 무산된다
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:75-76`
    (`TERMINAL_DURATION_MS_SQL` 정의) 및 사용처
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `cancelParkedExecution`(`durationMs: () => TERMINAL_DURATION_MS_SQL` 라인),
    `markWebChatIdleTimeout`, `markExecutionCancelled`, `markQueueWaitTimeout`,
    `finalizeStalledExhausted` 각 함수 내 `.set({ ... durationMs: () => TERMINAL_DURATION_MS_SQL })`
    블록.
  - 상세: `TERMINAL_DURATION_MS_SQL` 은
    `GREATEST(0, (EXTRACT(EPOCH FROM (:terminalFinishedAt::timestamptz - started_at)) * 1000)::bigint)::int`
    — 하한(시계 역행)은 `GREATEST(0, …)` 로 방어했지만 **상한 방어가 없다**. 마지막
    `::int` 캐스팅은 PostgreSQL 에서 `bigint→integer` 명시적 캐스트이며, 값이 int4 범위
    (`-2147483648`~`2147483647`, ≈24.855일)를 벗어나면 `ERROR: integer out of range` 로
    **문장 전체가 실패**한다. 마이그레이션(`codebase/backend/migrations/V001__initial_schema.sql:223`)
    에서 `duration_ms INTEGER` 로 선언돼 있고, 같은 저장소의 `V083__execution_active_running_ms.sql:17-18`
    주석이 이미 "int4(최대 ~2.1e9 ms ≈ 24일)" 한계를 인지하고 있다 — 다만 그 컬럼(`active_running_ms`)은
    세그먼트 타임아웃(기본 30분)으로 값이 상한되어 안전하다고 명시한 반면, 이번에 SQL 로
    옮겨진 `duration_ms` 는 **`started_at`(생성/기동 시각) 대비 wall-clock 전체 경과**라 상한이 없다.
    특히 `cancelParkedExecution`·`markWebChatIdleTimeout`(§EIA-RL-07 공개 웹채팅 idle-wait
    reaper — "모든 발급 토큰이 영구 만료된" 오래 방치된 park 를 대상으로 함)은 설계상
    **장기간 parked 상태**를 다루므로 24.8일을 넘는 실행이 실무적으로 도달 가능하다.
    이 두 경로는 `this.dataSource.transaction(...)` 로 감싸여 있어 UPDATE 실패 시 트랜잭션
    전체가 롤백되고, 함수 최상위 `try/catch` 가 에러를 로그만 남기고 삼킨다 —
    즉 **취소 자체가 되지 않는다**(단순히 `durationMs` 만 비는 게 아니라 status 전이·
    동반 NodeExecution 취소까지 통째로 실패). reaper 는 이 실행을 매 tick 마다 재시도하지만
    경과 시간은 계속 늘어나기만 하므로 **영구적으로 취소 불가능한 좀비 execution** 이 된다.
    이전(이 PR 이전)에는 이 5개 raw UPDATE 경로가 `durationMs` 를 아예 계산·영속하지 않았으므로
    이 실패 모드가 존재하지 않았다 — 이번 변경이 새로 만든 위험이다.
  - 제안: (a) 컬럼을 `bigint` 로 확장하거나(마이그레이션 필요, breaking 아님 — widening),
    (b) SQL 식에 상한 클램프를 추가 (`LEAST(2147483647, GREATEST(0, …))`) 해 오버플로 시
    에러 대신 클램프된 값을 기록하도록 한다. 후자가 스키마 변경 없이 즉시 적용 가능하고
    `resolveTerminalDurationMs`(JS 경로)의 "알 수 없으면 null, 실패해도 종결 흐름은 막지 않는다"
    는 이 PR 자신의 설계 원칙과도 일치한다.

- **[INFO]** `finalizeStalledExhausted` 의 부모 `Execution` UPDATE 와 자식 `NodeExecution` cascade
  UPDATE 는 이번 diff 가 손대지 않은 기존 구조 그대로 **단일 트랜잭션으로 묶여 있지 않다**
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의
    `finalizeStalledExhausted` 함수 — 부모 UPDATE(`this.executionRepository.createQueryBuilder()...execute()`)
    와 자식 cascade UPDATE(`this.nodeExecutionRepository.createQueryBuilder()...execute()`)가
    별도 `execute()` 호출로 분리.
  - 상세: 같은 파일의 형제 함수 `cancelParkedExecution`/`markWebChatIdleTimeout` 은 정확히 같은
    "부모+자식 이중 UPDATE" 패턴을 review 이력(주석에 인용된 "ai-review WARNING #1")에 따라
    `this.dataSource.transaction(...)` 으로 원자화했다. `finalizeStalledExhausted` 만 그 처리를
    받지 않은 채 남아 있어, 두 UPDATE 사이에 크래시가 나면 부모는 FAILED, 자식 NodeExecution 은
    RUNNING 으로 잔류할 수 있다. 다만 이는 **이번 diff 가 도입한 변경이 아니라 기존 구조**이고,
    함수 자체 docstring 이 "이미 문서화된 zombie double-drive 노출과 동일 class 로, 신규 회귀가
    아니다" 라고 명시적으로 인지·수용하고 있다.
  - 제안: 이번 PR 범위 밖. 형제 함수들과의 일관성을 위해 추후 트랜잭션으로 통일하는 별도
    후속 작업을 고려할 수 있다는 점만 참고로 남긴다.

- **[INFO]** SQL 인젝션·파라미터 바인딩은 전부 안전
  - 상세: `TERMINAL_DURATION_MS_SQL` 은 코드 상수 문자열(사용자 입력 없음)이며, 그 안의
    `:terminalFinishedAt` 플레이스홀더는 5개 호출처 전부에서 `.setParameter(TERMINAL_FINISHED_AT_PARAM,
    terminalFinishedAt)` 로 `Date` 객체를 바인딩한다. `id`/`status`/`executionId` 등 나머지 조건절도
    모두 named parameter(`:id`, `:waiting`, `:...statuses` 등)를 사용해 문자열 concatenation 이 없다.
    `terminal-duration.spec.ts` 도 `TERMINAL_DURATION_MS_SQL` 이 선언한 파라미터 이름을 실제로
    포함하는지 정적으로 검증하는 테스트를 추가해 향후 이름 불일치(런타임 "파라미터 미바인딩")를
    방지한다.
  - 제안: 조치 불요.

- **[INFO]** 마이그레이션·인덱스·N+1·커넥션 관리·대량 데이터 페이지네이션 관점에서는 해당 없음
  - 상세: 이번 diff 는 전부 기존 컬럼(`duration_ms`)에 값을 채우는 것이며 신규 컬럼/인덱스/테이블
    변경이 없다. 모든 UPDATE 는 PK(`id`) 또는 이미 인덱싱된 조건(`status`, `execution_id`)으로
    단건/소수 row 를 대상으로 하는 조건부 UPDATE 라 N+1 이나 대량 스캔 우려가 없다. 커넥션은
    기존 `this.dataSource.transaction(...)`/repository 패턴을 그대로 재사용한다.

## 요약

이번 PR 의 핵심 DB 표면은 기존 `Execution.duration_ms` 컬럼을 raw UPDATE 문 내부 SQL 계산 +
`RETURNING` 으로 채우는 5개 신규 지점이며, 파라미터 바인딩·트랜잭션 원자성(2곳)·SQL 인젝션
방어는 전반적으로 견고하다. 다만 `duration_ms` 가 `INTEGER`(int4, ≈24.8일 상한)인데 이번 SQL 식에는
상한 클램프가 없어, 오래 parked 된(특히 공개 웹채팅 idle-wait) execution 을 취소하려 할 때
`integer out of range` 로 UPDATE 문 전체가 실패하고 트랜잭션이 롤백돼 취소 자체가 영구적으로
불가능해지는 회귀 가능성이 실측 가능한 근거(마이그레이션 주석이 스스로 int4 한계를 인지)와 함께
확인됐다 — 이 부분만 WARNING 으로 잡는다. `finalizeStalledExhausted` 의 비-트랜잭션 이중 UPDATE 는
기존 구조이며 이번 diff 가 만든 문제가 아니라 INFO 로 남긴다.

## 위험도

MEDIUM
