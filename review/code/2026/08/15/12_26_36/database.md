# 데이터베이스(Database) 코드 리뷰 — EIA 종결 이벤트 `durationMs` 배관

## 방법론 노트

프롬프트 번들이 핵심 소스 파일(`execution-engine.service.ts`, `retry-turn.service.ts`,
`terminal-duration.ts`, `terminal-duration.spec.ts` 등)의 diff 를 크기 제한으로 생략했다.
`git diff origin/main -- <path>` 로 전문을 직접 대조하고, `Read`/`grep -n` 으로 실제 파일을
열어 줄 번호를 실측했다(아래 위치는 전부 소스 파일의 실제 줄 번호).

이 브랜치는 이미 이번 세션에서 8차례 이상(`09_58_24`~`11_59_09`) DB 관점 리뷰를 거쳤고, 그
결과로 (1) int4 오버플로 CRITICAL 클램프, (2) AVG 집계 `status='completed'` 필터, (3)
`RETURNING` vacuous mock 정정이 이미 코드에 반영돼 있음을 확인했다. 이번 라운드는 그 반영
상태를 독립적으로 재검증하고, 이번 델타(마지막 리뷰 이후 커밋: `f79792621`·`777698bbe`·
`c4e6e8d96`·`ef1ed21d7`)에 새로 나타난 DB 표면이 있는지 확인했다.

## 발견사항

새로 발견한 Critical/Warning 없음.

- **[INFO]** int4(`INTEGER`) 오버플로 방어가 JS/SQL 두 경로 모두에 동일 상수로 적용돼 있음 — 재확인
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts:7`(`PG_INT4_MAX = 2147483647`),
    `:56`(`Math.min(span, PG_INT4_MAX)`), `:102-105`(`TERMINAL_DURATION_MS_SQL` 의
    `` LEAST(${PG_INT4_MAX}, …) ``). 컬럼 정의는
    `codebase/backend/migrations/V001__initial_schema.sql:223`(`duration_ms INTEGER`)로 실측
    일치.
  - 상세: `duration_ms` 컬럼이 int4(최대 ≈24.8일)인데 취소·타임아웃 경로(park·위젯 idle·재개
    실패·큐 대기·stalled 소진)는 오래 대기한 실행을 다루는 자리라 24.8일 초과가 정상
    시나리오다. 클램프 없이 `::int` 캐스팅하면 `integer out of range` 로 UPDATE 문 전체가
    실패해 실행이 영구 고착된다. 두 경로가 같은 상수를 공유하도록 고정돼 있고,
    `terminal-duration.spec.ts:68-79`가 SQL 상수 리터럴이 아닌 `PG_INT4_MAX` 보간을 단언해
    상수 drift 도 잡는다.
  - 제안: 없음(현행 유지).

- **[INFO]** AVG 집계 3곳의 `status='completed'` 필터 — 이 PR 자체가 만든 회귀를 같은 PR 안에서 닫음
  - 위치: `codebase/backend/src/modules/dashboard/dashboard.service.ts:100`,
    `codebase/backend/src/modules/statistics/statistics.service.ts:97`, `:225`
  - 상세: 종전엔 `duration_ms IS NOT NULL` 만으로 충분했다 — 취소·타임아웃 실행이 컬럼을 비워
    뒀기 때문에 자동으로 걸러졌을 뿐, 상태로 거르는 방어가 아니었다. 이 PR 이 그 컬럼을
    채우기 시작하면서 "대기 경과 시간"(최대 24.8일)이 "평균 실행 시간" 집계에 섞여 들어갈 뻔한
    자리였는데, 세 자리 모두 `status = :completedStatus`/`status = 'completed'` 로 막혀 있다.
    `dashboard.service.ts` 는 파라미터 바인딩(`:completedStatus`, `setParameters` 에서
    `ExecutionStatus.COMPLETED` 로 공급), `statistics.service.ts` 는 같은 SELECT 안의 다른
    상태 리터럴(`'failed'`, `'cancelled'`)과 동일한 하드코딩 문자열 스타일이라 일관성 있다 —
    둘 다 사용자 입력이 섞이지 않는 상수라 인젝션 표면은 아니다.
  - 제안: 없음. (`getNodeStats` 의 `node_execution.duration_ms` 집계는 이번 diff 가 건드리지
    않음을 `git diff origin/main...HEAD` 로 확인 — 이 필터 누락은 이 PR 범위 밖.)

- **[INFO]** 5개 raw `UPDATE … RETURNING` 경로 — 파라미터 바인딩·트랜잭션 경계 재확인
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
    `cancelParkedExecution`(~1023-1089, `dataSource.transaction` 으로 Execution+NodeExecution
    원자 갱신), `markWebChatIdleTimeout`(~1160-1230, 동일 트랜잭션 패턴), `markExecutionCancelled`,
    `markQueueWaitTimeout`, `finalizeStalledExhausted`(~3334-3400)
  - 상세: SQL 식(`TERMINAL_DURATION_MS_SQL`)은 하드코딩된 모듈 상수이고 유일한 가변 요소
    `:terminalFinishedAt` 은 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, ...)` 로
    `Date` 객체 바인딩된다. `WHERE`/`AND WHERE` 절도 기존과 동일하게 파라미터 바인딩을
    유지한다 — 문자열 결합 없음, SQL 인젝션 표면 없음. `cancelParkedExecution`/
    `markWebChatIdleTimeout` 은 Execution 상태 전이와 동반 NodeExecution 취소를 같은
    `manager` 트랜잭션 안에서 처리해 원자성을 보장하고, emit(부수효과)은 트랜잭션 커밋 이후
    수행돼 미확정 데이터에 대한 이벤트 방출을 막는다. `RETURNING` 으로 갱신값을 같은 왕복에
    되받아 별도 SELECT 재조회를 만들지 않는다(N+1 방지 방향).
  - 제안: 없음.

- **[INFO]** N+1 없음 — 전부 execution 1건당 1회 호출되는 종결 경로
  - 상세: `resolveTerminalDurationMs`/`toFiniteNumber` 호출부, raw UPDATE 5곳 전부
    `grep`으로 호출부를 전수 확인한 결과 노드 순회·배치 루프 내부에서 호출되지 않는다.
    `execution-engine.service.ts:3192`(`for (const executionId of reclaimedIds)`)와
    `:3241`(`for (const id of ids)`)은 이 PR 과 무관한 기존 크래시 재구동 로직으로, 각 항목은
    fire-and-forget 개별 재구동이라 배치 쿼리 패턴이 아니다.
  - 제안: 없음.

- **[INFO]** 인덱스 — 신규 쿼리 패턴 없음, 기존 인덱스로 충분
  - 상세: 추가된 `AND e.status = :completedStatus`/`'completed'` 필터는 이미
    `w.workspace_id`/`e.started_at` 로 좁혀진 집계(FILTER 절) 안에 걸리는 조건이라 새 인덱스가
    필요 없다. `execution.status` 자체는 `V002__indexes.sql:19`(`idx_execution_status`),
    `V105__execution_workflow_status_index.sql:13`(`idx_execution_workflow_status`)로 이미
    인덱싱돼 있다. `duration_ms` 는 필터·정렬 대상이 아니라 인덱스 요구가 없다.
  - 제안: 없음.

- **[INFO]** 마이그레이션 — 이번 PR 에 스키마 변경 없음
  - 상세: `git diff origin/main --stat -- codebase/backend/migrations` 결과 0건. `duration_ms
    INTEGER` 타입은 그대로 유지되고, int4 상한은 애플리케이션 레이어 클램프로 방어한다.
    `BIGINT` 로 넓히는 마이그레이션은 의도적으로 이 PR 범위 밖으로 미뤄졌고
    (`review/code/2026/08/15/09_58_24/RESOLUTION.md` §CRITICAL), `plan/in-progress/
    spec-sync-external-interaction-api-gaps.md` 에 후속으로 등재돼 있다. 무중단 배포 관점에서
    이번 PR 자체는 lock 을 유발하는 DDL 이 없다.
  - 제안: 없음(현행 유지). 후속 `BIGINT` 마이그레이션 시엔 `ALTER COLUMN ... TYPE bigint` 가
    Postgres 11+ 에서 rewrite 없이 즉시 적용되는 케이스(단순 폭 확장)인지 사전 확인 권장 —
    이번 PR 의 범위는 아니다.

## 이미 등재된 항목 (이번 PR 의 신규 결함 아님, 참고용)

- raw SQL 문자열의 컬럼명(`started_at`) 하드코딩 — 엔티티 메타데이터 대조 assertion 부재.
  `09_58_24`/`10_18_38` 라운드가 지적, 다음 편집 시 재검토로 유예(SQL 상수가 모듈 단위로
  격리돼 있어 즉각적 위험은 낮음).
- SQL 식의 값 수준 e2e 검증 부재(현재는 문자열 `toContain` 단위 테스트뿐) —
  `spec-sync-external-interaction-api-gaps.md` 에 트래커 등재.
- `duration_ms` 의 의미 혼재(실행 시간 vs 대기 경과 시간)를 별도 컬럼으로 분리하지 않고 한
  컬럼에 담는 설계 — spec §6.5 에 캐비엇으로 명시, 별도 필드 분리는 범위 밖 후속.
- REST `GET /api/external/executions/:id` 에 `durationMs` 미노출(push/재조회 비대칭) —
  DB 표면이 아니라 API 프로젝션 문제, 트래커 등재.

## 요약

이번 변경은 종결 이벤트(`completed`/`failed`/`cancelled`) payload 에 `durationMs` 를 채우는
배관 작업으로, 엔티티를 로드하지 않는 5개 raw UPDATE 경로는 계산을 SQL 로 밀어 `RETURNING`
으로 같은 왕복에 값을 되받는 설계를 택해 N+1 을 만들지 않았다. int4(`INTEGER`) 컬럼
오버플로에 대한 클램프가 JS/SQL 양쪽에 동일 상수(`PG_INT4_MAX`)로 적용돼 있고 회귀 테스트로
고정돼 있으며, 이 PR 이 유발할 뻔한 대시보드/통계 AVG 집계 오염(취소·타임아웃 실행의 "대기
시간" 이 "평균 실행 시간" 에 섞이는 문제)도 같은 PR 안에서 `status='completed'` 필터로
닫혔다. 파라미터 바인딩은 5개 raw UPDATE 전부 일관되게 유지돼 SQL 인젝션 표면이 없고, 다중
테이블(Execution+NodeExecution) 갱신이 필요한 두 경로는 트랜잭션으로 원자화돼 있다. 이번
PR 에 스키마 마이그레이션은 없으며, 남은 항목(컬럼명 하드코딩·값 수준 e2e 부재·컬럼 타입
확장)은 전부 이전 라운드들이 근거와 함께 트래커에 등재해 둔 기지의 out-of-scope 항목이다.

## 위험도

NONE
