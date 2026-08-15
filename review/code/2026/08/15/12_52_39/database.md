# 데이터베이스(Database) 코드 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (9차 라운드)

## 방법론 노트

프롬프트 번들이 핵심 소스 파일(`execution-engine.service.ts`, `retry-turn.service.ts`,
`terminal-duration.ts` 등)의 diff 를 크기 제한으로 생략했다. `git diff origin/main -- <path>`,
`Read`, `grep -n` 으로 실제 소스를 직접 열어 줄 번호를 실측했다(아래 위치는 전부 소스 파일의
실제 줄 번호). `git log -1`/`git status` 로 확인한 결과, 이번 라운드(`12_52_39`)는 직전
라운드(`12_26_36`, RESOLUTION 커밋 `f9e8c7b03`) 이후 신규 커밋이 없는 **동일 누적 diff**에
대한 재검토다. 이 브랜치는 이미 이번 세션에서 8차례 DB 관점 리뷰를 거쳤고 (1) int4 오버플로
CRITICAL 클램프(JS+SQL 양쪽), (2) AVG 집계 `status='completed'` 필터, (3) `stop()` REST
경로의 동일 오버플로 회귀가 모두 코드에 반영돼 있음을 직접 재확인했다. 이번 라운드는 그 위에서
**직전 라운드(`12_26_36/database.md`)가 스스로 내린 판정 하나를 실측으로 재검증**했고, 그
과정에서 사실 오류를 하나 발견했다(아래 WARNING).

## 발견사항

- **[WARNING]** `finalizeStalledExhausted` 도 Execution+NodeExecution **2-테이블 쓰기**인데
  트랜잭션으로 원자화돼 있지 않다 — 직전 라운드(`12_26_36/database.md:48-61,111`)가 "다중
  테이블 갱신이 필요한 두 경로(`cancelParkedExecution`/`markWebChatIdleTimeout`)만 트랜잭션
  원자화" 라고 판정했는데, 실측 결과 **세 번째 경로**가 같은 패턴이면서 빠져 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:3334`
    (`finalizeStalledExhausted` 선언) — Execution UPDATE `:3342-3360`, NodeExecution cascade
    UPDATE `:3374-3389`. 두 `await` 사이에 `this.dataSource.transaction(...)` 래핑이 없다
    (비교: `cancelParkedExecution` `:1028`, `markWebChatIdleTimeout` `:1165` 는
    `this.dataSource.transaction(async (manager) => {...})` 로 두 UPDATE 를 감싼다).
  - 상세: 이 함수의 자체 JSDoc(`:3323`)이 "자식 RUNNING NodeExecution 도 cascade
    마감(유령 running 제거)" 이라고 명시한다 — 즉 설계 의도 자체가 두 테이블을 함께
    terminal 로 맞추는 것이다. 그런데 실제 구현은 (1) `Execution` 을 `FAILED` 로 UPDATE(이번
    diff 가 `durationMs: () => TERMINAL_DURATION_MS_SQL` 을 여기에 추가했다) → (2) 별도
    호출로 `NodeExecution` 을 `FAILED` 로 cascade UPDATE, 이 두 단계가 각자 독립 커밋되는
    autocommit 문장이다. 호출자(`execution-run.processor.ts:88`)는
    `void this.engine.finalizeStalledExhausted(executionId).catch((err) => logger.error(...))`
    로 예외를 **로깅만 하고 재시도하지 않는다.** 따라서 (1)이 성공 커밋된 뒤 (2)에서 일시적
    DB 오류·타임아웃·프로세스 크래시가 나면, `Execution` 은 `FAILED` 로 종결되는데 그 자식
    `NodeExecution` 행은 **영구 `RUNNING` 으로 잔류**한다 — 형제 함수의 문서(`:1017-1021`,
    `:1157-1161`)가 "비-트랜잭션 2단계였을 때는 첫 UPDATE 커밋 후 둘째가 실패하면
    NodeExecution 이 영구 WAITING 으로 잔류" 라고 정확히 같은 실패 모드를 경고하며 트랜잭션을
    도입한 그 자리다. `:3325-3332` 의 "알려진 이론적 race(수용)" 각주는 **다른 레이스**(job
    stalled 소진과 `recoverStuckExecutions` 재구동 backstop 이 겹치는 타이밍 문제)를 가리키며
    이 partial-commit 문제를 다루지 않는다.
  - 이 함수는 `#798`(PR4 stalled 재배달)에서 도입된 기존 구조이고 이번 PR 은 `durationMs` SQL
    계산·`RETURNING` 확장만 추가했을 뿐 트랜잭션 구조 자체를 바꾸지 않았다(`git diff
    origin/main` 확인) — 즉 이 PR 이 만든 신규 회귀는 아니다. 다만 같은 PR 이 구조적으로
    동일한 2-테이블 종결 쓰기 패턴을 `cancelParkedExecution`/`markWebChatIdleTimeout` 두
    곳에서 **트랜잭션으로 하드닝**했고 이 함수도 diff 로 직접 건드렸는데, 그 하드닝이 세 번째
    자매 함수에는 적용되지 않았다.
  - 제안: `finalizeStalledExhausted` 의 두 UPDATE(Execution → FAILED, NodeExecution cascade →
    FAILED)를 `this.dataSource.transaction(async (manager) => {...})` 로 묶어 형제 두 함수와
    동일 패턴으로 통일. 비용은 낮다(이미 같은 파일에 두 개의 참조 구현이 있다). 이 PR 범위 밖
    (pre-existing) 이라 판단하면, 최소한 트래커(`plan/in-progress/
    spec-sync-external-interaction-api-gaps.md`)에 근거와 함께 명시적으로 등재할 것을 권장한다
    — 확인 결과 현재 이 항목은 어느 plan/트래커/이전 8회 리뷰 라운드에도 등재돼 있지 않다.

## 확인 결과 (이전 라운드 판정의 재검증)

- **int4 오버플로 클램프 — 재확인, 문제 없음.** `terminal-duration.ts:7`(`PG_INT4_MAX =
  2147483647`), `:56`(`Math.min(span, PG_INT4_MAX)`), `:104`(`LEAST(${PG_INT4_MAX}, …)`) 모두
  동일 상수 공유. `executions.service.ts:796-800`(`stop()`)도 같은 헬퍼로 통일돼 있음을
  `Read` 로 직접 확인.
- **AVG 집계 오염 방지 — 재확인, 문제 없음.** `dashboard.service.ts:96-100`,
  `statistics.service.ts:95-97,222-225` 모두 `e.status = :completedStatus`/`'completed'`
  필터가 실제 소스에 남아 있다.
- **파라미터 바인딩 — 재확인, 문제 없음.** 5개 raw UPDATE(`cancelParkedExecution:1038`,
  `markWebChatIdleTimeout:1175`, `markExecutionCancelled:2832`, `markQueueWaitTimeout:2903`,
  `finalizeStalledExhausted:3356`) 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, ...)` 로
  `Date` 객체 바인딩, `WHERE`/`AND WHERE` 도 기존과 동일하게 파라미터화. 문자열 결합 없음 —
  SQL 인젝션 표면 없음.
- **N+1 — 재확인, 문제 없음.** 5개 raw UPDATE·`resolveTerminalDurationMs`/`toFiniteNumber`
  호출부 전부 execution 1건당 1회 종결 경로. 노드 순회·배치 루프 내부 호출 없음.
- **인덱스 — 재확인, 문제 없음.** `NodeExecution` cascade UPDATE 의
  `WHERE execution_id = :executionId AND status = :running` 은 `V002__indexes.sql:22`
  (`idx_node_execution_execution`)와 `V095__node_execution_exec_status_active_index.sql`
  (execution_id+status 복합, active 상태 부분 인덱스)로 커버된다. AVG 집계에 추가된
  `status = :completedStatus` 필터는 기존 `workspace_id`/`started_at` 로 좁혀진 FILTER 절
  안의 조건이라 신규 인덱스 불요.
- **마이그레이션 — 재확인, 해당 없음.** `git diff origin/main --stat -- codebase/backend/
  migrations` 0건. `duration_ms INTEGER` 컬럼 타입 변경 없음(애플리케이션 레이어 클램프로
  방어, `BIGINT` 확장은 의도적으로 범위 밖 후속).
- **커넥션 관리 — 문제 없음.** 전부 DI 주입된 `Repository`/`DataSource` 경유, 수동 커넥션
  획득·해제 없음. `dataSource.transaction()` 콜백 패턴이 TypeORM 표준 방식으로 커넥션
  반환을 프레임워크가 보장.

## 이미 등재된 항목 (참고용, 이번 PR 신규 결함 아님)

- raw SQL 문자열의 컬럼명(`started_at`) 하드코딩 — 엔티티 메타데이터 대조 부재. 유예됨.
- SQL 식의 값 수준 e2e 검증 부재(현재 문자열 `toContain` 단위 테스트뿐) — 트래커 등재.
- `duration_ms` 의 의미 혼재(실행 시간 vs 대기 경과 시간) — 별도 필드 분리는 범위 밖 후속.
- REST `GET /api/external/executions/:id` 의 `durationMs` 미노출 — DB 표면 아닌 API 프로젝션
  문제, 트래커 등재.
- retry-turn 재진입 시 DB 커밋값과 in-memory emit 값 어긋남(W1, `10_34_51`) — DB write 경로
  변경이 필요해 후속 PR 로 유예.

## 요약

핵심 DB 안전장치(int4 클램프, AVG 집계 상태 필터, 파라미터 바인딩, N+1 부재, 인덱스 커버리지,
무-마이그레이션)는 8차에 걸친 이전 라운드의 판정대로 소스에 실제 반영돼 있음을 직접
재확인했다. 이번 라운드에서 새로 잡은 것은 하나다 — 직전 라운드가 "다중 테이블 갱신 경로는
전부 트랜잭션으로 원자화됐다" 고 적었는데, 실측 결과 `finalizeStalledExhausted` 도 동일하게
Execution+NodeExecution 2-테이블을 쓰면서 트랜잭션 밖에 있다. pre-existing 구조라 이 PR 의
신규 회귀는 아니지만, 이 PR 이 그 함수를 직접 확장했고 같은 PR 안에서 구조적으로 동일한 두
자매 함수는 이미 트랜잭션으로 하드닝했다는 점에서 지적할 가치가 있다 — 실패 모드(자식
NodeExecution 이 영구 RUNNING 으로 잔류)는 형제 함수 docstring 이 이미 명시적으로 경고한
바로 그것이다. 그 외에는 새로 발견된 Critical/Warning이 없다.

## 위험도

LOW
