# 데이터베이스(Database) 리뷰 — EIA 종결 이벤트 `durationMs` 배관 (11_29_02 라운드)

## 리뷰 범위 및 방법

DB 관점에서 실질 대상은 4개 프로덕션 파일이다 (프롬프트에서 크기 제한으로 diff 가 생략된
파일은 `Read`/`Bash`(`git diff origin/main --stat`, `grep -n`)로 저장소를 직접 열어 대조했다):

- `codebase/backend/src/shared/utils/terminal-duration.ts` (신규) — raw UPDATE 용 SQL 상수(`TERMINAL_DURATION_MS_SQL`) + JS 계산 헬퍼(`resolveTerminalDurationMs`) + 파싱 헬퍼(`toFiniteNumber`)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — raw `UPDATE ... RETURNING` 5경로(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·`markQueueWaitTimeout`·`finalizeStalledExhausted`) + 엔티티 기로드 경로 다수
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — 엔티티 기로드 경로, JS 계산만(raw SQL 없음)
- `*.spec.ts`(테스트, 프로덕션 쿼리 없음), `chat-channel/*`·`types.ts`(wire 타입, DB 무관), `plan/**`·`review/**`·`CHANGELOG.md`(문서, DB 무관) — 검토는 했으나 DB 관점 발견사항 없음

이 diff 는 이미 같은 브랜치에서 DB 리뷰가 3라운드(`09_58_24`→`10_18_38`→`11_09_44`) 반복됐고,
그중 CRITICAL 2건(SQL 경로 int4 미클램프, 이어서 JS 경로 int4 미클램프)이 각각 조치돼
`RESOLUTION.md` 로 남아 있다. 이번 라운드는 그 조치가 diff 최종본에 실제로 반영됐는지를
독립적으로 재검증하는 데 집중했다.

## 발견사항

발견된 Critical/Warning 없음. 아래는 확인 결과(INFO)만 기록한다.

- **[INFO]** 직전 두 CRITICAL(SQL 경로 → JS 경로 순으로 발견된 `duration_ms` int4 상한 미클램프)이 이 diff 최종본에 실제로 반영돼 있고, 두 경로가 상수를 공유해 drift 가 구조적으로 봉쇄됨
  - 위치: `codebase/backend/src/shared/utils/terminal-duration.ts` — `PG_INT4_MAX`(export 상수) 정의부, `resolveTerminalDurationMs`(`Math.min(span, PG_INT4_MAX)` 클램프), `TERMINAL_DURATION_MS_SQL`(`LEAST(${PG_INT4_MAX}, …)` 로 같은 상수를 문자열 보간)
  - 상세: `grep -n "getTime() -"` 로 execution 레벨 `durationMs` 대입 지점을 전수 확인한 결과, `retry-turn.service.ts`(3곳: L713-714, L895-896, L948-949)와 `execution-engine.service.ts`(7곳: L639, L2414, L2578, L3565, L4295, L4755, L4883, L4944)가 **예외 없이** `resolveTerminalDurationMs(...)` 를 경유한다 — 맨손 `finishedAt.getTime() - startedAt.getTime()` 대입은 execution 레벨에 하나도 남아 있지 않다(남은 `getTime() -` 패턴은 전부 `nodeExecution`/`nodeExec` 레벨로, 이 PR 이 건드리지 않는 별개 컬럼이다). raw UPDATE 5경로도 전부 `TERMINAL_DURATION_MS_SQL` 을 재사용한다(`grep -n "TERMINAL_DURATION_MS_SQL"` → 5회). JS·SQL 두 경로가 리터럴 숫자가 아니라 **같은 export 상수** `PG_INT4_MAX`를 참조하므로, 이후 한쪽만 고치는 재발(직전 두 라운드가 이미 겪은 형태)이 구조적으로 어렵다. `terminal-duration.spec.ts:68-78`·`:141-146` 이 saturate 값과 SQL 문자열 안의 상수 존재를 각각 회귀 테스트로 고정한다.
  - 제안: 없음(이미 조치·재검증됨). 신규 CRITICAL 없음.

- **[INFO]** raw SQL 삽입은 파라미터 바인딩만 사용 — SQL 인젝션 표면 없음(이전 라운드와 동일 결론, 재확인)
  - 위치: `execution-engine.service.ts:1036-1043`(`cancelParkedExecution`), `:1173-1180`(`markWebChatIdleTimeout`), `:2830-2849`(`markExecutionCancelled`), `:2901-2906`(`markQueueWaitTimeout`), `:3354-3359`(`finalizeStalledExhausted`)
  - 상세: `.set({ durationMs: () => TERMINAL_DURATION_MS_SQL })` 로 삽입되는 문자열은 하드코딩 모듈 상수(사용자 입력 无)이고, 유일한 가변 값(`terminalFinishedAt`/`finishedAt`, 서버 생성 `Date`)은 5곳 전부 `.setParameter(TERMINAL_FINISHED_AT_PARAM, …)` 로 바인딩된다. `WHERE`/`AND WHERE` 절도 기존과 동일하게 `:id`/`:waiting`/`:pending`/`IN (:...statuses)` 파라미터 바인딩을 유지한다. 문자열 결합(concat) 없음.
  - 제안: 없음.

- **[INFO]** 트랜잭션 경계는 이 PR 이 바꾸지 않았다
  - 상세: `cancelParkedExecution`/`markWebChatIdleTimeout`은 Execution+NodeExecution 이중 UPDATE 를 `this.dataSource.transaction()` 으로 묶는 기존 구조를 유지한다(이 diff 는 그 안의 `SET`/`RETURNING` 절만 확장). `markExecutionCancelled`/`markQueueWaitTimeout`은 단일 UPDATE 문뿐이라 트랜잭션 불필요(단일 문장은 Postgres 암묵적 원자성). `finalizeStalledExhausted`는 Execution UPDATE 후 NodeExecution cascade UPDATE 를 트랜잭션 없이 순차 실행하는데, `git show origin/main:...execution-engine.service.ts`로 대조한 결과 **이 비-트랜잭션 이중 UPDATE 구조는 이 PR 이전부터 동일**했다(이 PR 은 `durationMs` SET 절 추가 + `returning(['id'])`→`returning(['id','duration_ms'])` 확장만 했다) — 신규 회귀 아님.
  - 제안: 없음(이 diff 범위 밖 pre-existing 설계).

- **[INFO]** 마이그레이션 없음 — 무중단 배포 리스크 없음
  - 상세: `git diff origin/main --stat`으로 확인한 결과 이 diff 에 신규/수정 마이그레이션 파일이 없다. `duration_ms` 컬럼(`INTEGER`)은 기존 `V001__initial_schema.sql`/`V083__execution_active_running_ms.sql` 에서 이미 존재·nullable이며, 이번 변경은 그 컬럼에 쓰는 값의 계산 로직만 바꾼다.
  - 제안: 없음.

- **[INFO]** `markQueueWaitTimeout` 경로는 같은 컬럼(`duration_ms`)에 "실행 시간"이 아니라 "큐 대기 시간"을 싣는다(의도적, 문서화·트래커 등재됨) — 이전 라운드와 동일 관찰, 재발 아님
  - 위치: `execution-engine.service.ts:2898-2901` 주석 + `CHANGELOG.md` Unreleased 항목 + `plan/in-progress/spec-draft-eia-notification-payload-contract.md`
  - 상세: `started_at`이 admission(RUNNING 전이) 이전 큐 진입 시각으로 설정돼 있어, 이 경로가 계산하는 값은 의미상 "실행 소요"가 아니라 "대기 소요"다. 같은 컬럼이 경로별로 다른 의미를 갖는 것은 약한 비정규화지만 스펙·주석·CHANGELOG 3곳에 일관되게 고지돼 있어 은닉된 정보 손실은 아니다. 이 값이 향후 "평균 실행 시간" 등 집계(AVG)에 섞이면 통계가 오염될 수 있다는 점은 이미 별도 트래커(`10_34_51` W3)에 등재돼 이 PR 범위 밖으로 명시적으로 분리돼 있다.
  - 제안: 없음(이미 트래킹됨).

## 그 외 점검 결과 (이슈 없음)

- **인덱스**: 5개 raw UPDATE 전부 `WHERE id = :id`(PK)로 단일 행을 특정하고 `status`는 부가 필터. 이 PR 이 WHERE 절 구조 자체를 바꾸지 않았고 추가 인덱스가 필요한 신규 스캔 패턴도 없다.
- **N+1 쿼리**: 5개 raw UPDATE 경로 모두 execution 1건당 단일 UPDATE 문이며, 노드 순회·배치 루프 내부에서 호출되지 않는다(`grep`으로 호출부 전수 확인). `RETURNING`으로 값을 되받아 오히려 UPDATE 후 별도 SELECT 재조회 왕복을 없앴다.
- **커넥션 관리**: TypeORM `Repository`/`DataSource` 표준 경로만 사용, 수동 커넥션 획득·해제 없음. 이 PR 이 커넥션 관리 패턴을 바꾸지 않았다.
- **대량 데이터**: 전부 단일 행 point UPDATE — 페이지네이션·풀스캔과 무관.
- **스키마 설계**: 신규 컬럼·테이블·관계 변경 없음. `retry-turn.service.ts`는 raw SQL 경로가 아예 없고, 전부 이미 로드된 엔티티에서 `resolveTerminalDurationMs()`로 순수 JS 계산만 해 DB 왕복이 늘지 않는다.
- **`RETURNING` 값 파싱**: `toFiniteNumber`가 pg 드라이버의 문자열 반환(bigint/numeric)·`NaN`·비정상 값을 방어적으로 숫자/`null`로 좁혀 wire 로 비정상 값이 나가는 경로를 차단한다.

## 요약

이 diff는 스키마 변경 없이(신규 마이그레이션 0건) 종결 이벤트 3종의 `durationMs` 계산을 한 곳(`terminal-duration.ts`)에 응집시키는 배관 작업이다. 이 브랜치에서 직전 두 라운드에 걸쳐 발견된 CRITICAL(먼저 SQL 경로, 이어서 JS 경로의 `duration_ms` int4 상한 미클램프 → UPDATE 실패 → 실행 영구 고착)은 이번 라운드에서 `grep`으로 execution 레벨 대입 지점을 전수 재검증한 결과 예외 없이 클램프 헬퍼를 경유하며, JS·SQL 두 경로가 리터럴이 아니라 export 상수 `PG_INT4_MAX`를 공유해 "한쪽만 고쳐 다른 쪽에 같은 결함이 재발"하는 이 브랜치의 반복 패턴이 구조적으로 봉쇄됐다. SQL 삽입은 하드코딩 상수+파라미터 바인딩만 사용해 인젝션 표면이 없고, 트랜잭션 경계·인덱스 사용·커넥션 관리·N+1 여부 모두 이 PR이 새로 손댄 지점이 없다(`finalizeStalledExhausted`의 비-트랜잭션 이중 UPDATE는 `git show origin/main`으로 대조해 이 PR 이전부터 존재하던 pre-existing 구조임을 확인했다). 남은 관찰(같은 컬럼이 경로별로 "실행 시간"/"큐 대기 시간" 두 의미를 갖는 약한 비정규화, 컬럼명 하드코딩의 정적 검증 부재, SQL 값의 e2e 미검증)은 전부 문서·주석·별도 트래커에 근거와 함께 이미 등재돼 있어 이번 diff를 막을 신규 결함이 아니다.

## 위험도

LOW
