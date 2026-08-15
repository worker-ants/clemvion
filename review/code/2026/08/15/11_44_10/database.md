# 데이터베이스(Database) 코드 리뷰 — `durationMs` 종결 이벤트 배관 (6차 라운드)

## 방법론 노트

프롬프트 번들이 핵심 소스 파일(`execution-engine.service.ts`, `retry-turn.service.ts`,
`terminal-duration.ts`)의 diff 를 크기 제한으로 생략했다. `git diff origin/main -- <path>`
로 전문을 직접 대조했고, `duration_ms` 컬럼 정의(`V001__initial_schema.sql`)·
`finalizeGuarded`/`COALESCE` 구조·클램프 회귀 테스트(`terminal-duration.spec.ts`)도
`Read`/`Grep` 으로 실측했다. 이 세션은 이미 5차례(`09_58_24`/`10_18_38`/`10_34_51`/
`10_52_08`/`11_09_44`/`11_29_02`) DB 리뷰를 거쳤고, `11_09_44` 에서 CRITICAL(SQL 경로만
클램프하고 JS 경로가 무방비였음)이 확인·수정됐다. 이번 라운드의 목적은 (a) 그 수정이
실제로 양쪽 모두에 적용됐는지 재확인, (b) `11_09_44`/`11_29_02` 이후 신규 커밋
(`2c9b490fd`, `bd611be81`, `f5c609aa8`)이 DB 관점에서 새 리스크를 만들지 않았는지
확인이다.

## 발견사항

새로 발견한 Critical/Warning 없음. 아래는 확인·재확인 결과(INFO)만 기록한다.

- **[INFO]** CRITICAL(int4 오버플로) 수정이 JS·SQL 두 경로 모두에 실제로 반영돼 있고, 두
  경로가 **같은 상수**를 공유함을 실측 확인
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` — `PG_INT4_MAX` 상수
    정의, `resolveTerminalDurationMs`(`Math.min(span, PG_INT4_MAX)`), `TERMINAL_DURATION_MS_SQL`
    (`LEAST(${PG_INT4_MAX}, …)`)
  - 상세: `duration_ms` 컬럼은 `INTEGER`(int4, 최대 ≈24.8일 — `codebase/backend/migrations/V001__initial_schema.sql:223`)다.
    `11_09_44` 라운드가 "SQL 만 클램프하고 JS(`resolveTerminalDurationMs`)는 무방비였다"는
    CRITICAL 을 잡았는데, 이번 라운드에서 `Read`/`grep` 으로 재확인한 결과 두 경로 모두
    `PG_INT4_MAX` **단일 export 상수**를 참조하도록 고정돼 있다 — 한쪽만 고쳐 같은 결함이
    다른 경로에 남는 패턴(이 세션이 이미 두 번 겪은 형태)이 이번엔 재발하지 않았다.
    회귀 테스트도 양쪽에 존재한다: `terminal-duration.spec.ts:66-78`("int4 상한을 넘으면
    saturate" — JS 경로), `:141-145`(`TERMINAL_DURATION_MS_SQL` 이 `LEAST(2147483647`
    포함을 단언 — SQL 경로).
  - 제안: 없음(해소 확인).

- **[INFO]** SQL 인젝션 표면 없음 — 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1036-1043`,
    `:1173-1180`, `:2830-2849`, `:2901-2906`, `:3351-3356` (5개 raw UPDATE 호출부)
  - 상세: `TERMINAL_DURATION_MS_SQL` 은 하드코딩된 모듈 상수 문자열이며, 유일한 가변 요소
    `:terminalFinishedAt` 은 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, terminalFinishedAt)`
    로 `Date` 객체 바인딩된다. `WHERE`/`AND WHERE` 절도 기존과 동일하게 named parameter
    (`:id`, `:waiting`, `:pending`, `:running`)를 유지한다. 문자열 concatenation 없음.
  - 제안: 없음.

- **[INFO]** 트랜잭션 경계 변경 없음 — 재확인
  - 위치: `cancelParkedExecution`(`execution-engine.service.ts:1023` 부근,
    `this.dataSource.transaction(...)`), `markWebChatIdleTimeout`(`:1160` 부근, 동일)
  - 상세: 두 함수 모두 부모 `Execution` UPDATE + 자식 `NodeExecution` cascade UPDATE 를
    묶는 기존 `dataSource.transaction()` 블록 구조가 그대로 유지된다. 이번 diff 는 그
    블록 **안**에 `durationMs: () => TERMINAL_DURATION_MS_SQL` 과 `.returning(['id', 'duration_ms'])`
    를 추가했을 뿐 트랜잭션 범위·WHERE 가드·`affected` 체크는 손대지 않았다.
    `markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted` 는 단일
    UPDATE 문이라 자체 원자적이며, `finalizeStalledExhausted` 의 부모/자식 비-트랜잭션
    이중 UPDATE 는 이 PR 이 만든 구조가 아니라 pre-existing(함수 docstring 이 스스로
    인지)이고 이전 라운드들이 이미 동일하게 판단했다.
  - 제안: 없음.

- **[INFO]** N+1·인덱스·대량 데이터 — 해당 없음, 재확인
  - 상세: 이번 라운드의 신규 커밋(`2c9b490fd`/`bd611be81`/`f5c609aa8`)은 JS 계산 헬퍼
    전환 마무리(누락 경로 클램프)와 테스트 단언 보강뿐이며, 새 쿼리·새 반복 호출을
    도입하지 않는다. 모든 UPDATE 는 PK(`id`) + 상태 가드(`status = :expected`)로 단건
    대상이고, 노드 순회나 배치 루프 내부에서 호출되지 않는다.
  - 제안: 없음.

- **[INFO]** `retry-turn.service.ts` 재진입 시 DB(COALESCE 로 보존된 값)와 emit(in-memory
  값)이 어긋날 수 있는 경로 — **이번 diff 가 만든 것이 아니며, 이미 트래커에 등재됨**
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:637-650`
    (`finalizeGuarded` CANCELLED 분기, `durationMs: () => 'COALESCE(duration_ms, :newDurationMs)'`)
  - 상세: `stop()` 이 먼저 커밋한 T1 값은 `COALESCE` 로 DB 에 보존되지만, 그 순간 in-memory
    `execution.durationMs` 는 갱신되지 않은 채 emit payload 에 실린다(T2). 이번 라운드에서
    이 블록의 diff 여부를 확인했으나 **변경 없음** — `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    "retry-turn 재진입 시 DB 와 emit 의 `durationMs` 가 어긋난다" (`10_34_51` W1) 로 이미
    등재돼 있고, 처방(`.returning(['duration_ms'])` 로 persist 값을 되읽기)은 DB write 경로
    자체를 바꾸는 별건이라 이 PR 범위 밖으로 판단한 이전 라운드 결정이 여전히 유효하다.
  - 제안: 신규 조치 불필요(이미 등재). 재론 목적 없이 확인만 기록.

- **[INFO]** `duration_ms` 의미 혼재(실행 시간 vs 대기 시간)로 인한 AVG 집계 오염 —
  이번 diff 범위 밖, 이미 등재됨
  - 상세: `markQueueWaitTimeout` 등 5경로 중 다수의 값은 실행 시간이 아니라 대기 시간이다
    (`execution-engine.service.ts:2898` 주석이 이를 명시). `status` 필터 없이 이 컬럼을
    평균 내는 소비처(대시보드 `avgExecutionTime`, 통계 `avgDurationMs`, 실행 목록 Duration
    컬럼)가 있으나, 그 소비처는 다른 모듈이라 이 PR 범위 밖이며
    `plan/in-progress/spec-sync-external-interaction-api-gaps.md` "`duration_ms` 에 '대기
    시간'이 섞여 집계를 오염시킨다" (`10_34_51` W3) 로 이미 등재돼 있다.
  - 제안: 신규 조치 불필요.

- **[INFO]** raw SQL 문자열에 컬럼명(`started_at`) 하드코딩, 값 수준 e2e 검증 부재 —
  이미 등재됨, 재확인만
  - 상세: `TERMINAL_DURATION_MS_SQL` 이 실제 Postgres 에서 값 수준으로 검증된 적이 없다
    (단위 테스트는 문자열 `toContain` 뿐). `plan/in-progress/spec-sync-external-interaction-api-gaps.md`
    "`durationMs` 후속 2건"에 두 항목 모두 등재돼 있고, CRITICAL 이 리뷰로만 잡혔던 이력을
    고려하면 우선순위 있는 후속으로 남겨 둘 가치가 있다는 이전 판단이 유효하다.
  - 제안: 신규 조치 불필요.

- **[INFO]** 신규 마이그레이션·신규 컬럼/인덱스 없음
  - 상세: `git diff origin/main --stat` 에 `migrations/**` 파일이 없다. `duration_ms` 는
    `V001__initial_schema.sql:223`(Execution), `:242`(NodeExecution)에 이미 존재하는
    `INTEGER` 컬럼이며 이번 PR 은 여기에 값을 채울 뿐 스키마 변경이 없다. 무중단 배포
    관점 리스크 없음.
  - 제안: 없음.

## 요약

6차 라운드 시점 기준, 이 PR 의 DB 표면(5개 엔티티-미로드 raw UPDATE + `RETURNING`, 다수의
in-memory JS 계산 경로)은 이전 라운드가 잡은 CRITICAL(int4 오버플로 — SQL 경로만 클램프)이
JS 경로에도 실제로 적용돼 두 경로가 하나의 export 상수(`PG_INT4_MAX`)를 공유하는 상태로
수렴했음을 이번 라운드에서 직접 확인했다. 이번 라운드의 신규 커밋은 그 클램프 마무리와
테스트 단언 보강(누락된 mock threading 정정)뿐이며 새 SQL·새 트랜잭션 경계·새 쿼리
패턴을 만들지 않는다. 파라미터 바인딩·트랜잭션 원자성·마이그레이션 부재 모두 견고하다.
남아 있는 DB 관점 항목(retry-turn 재진입 DB↔emit 불일치, AVG 집계 오염, SQL 값 수준
e2e 검증 부재, 컬럼명 하드코딩)은 전부 이번 diff 가 만든 신규 결함이 아니라 이전 라운드가
이미 근거와 함께 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md`)에
등재해 둔 것이며, 이번 라운드에서 diff 미변경을 재확인했을 뿐이다.

## 위험도

LOW
