# 데이터베이스(Database) 리뷰 결과

## 검토 범위

이번 diff(`origin/main...HEAD`)의 DB 관련 실질 변경은 다음 소스 파일에 집중된다. 나머지는
plan 문서·이전 리뷰 세션 산출물(`review/**`)로 DB 관점 신규 코드가 아니다.

- `codebase/backend/src/common/utils/update-returning-rows.ts` (신규 헬퍼)
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (2개 소비 지점)
- `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts` (5개 소비 지점)
- `codebase/backend/src/modules/auth/auth-oauth.service.ts` (1개 소비 지점 + snake_case 컬럼 매핑 수정)
- `codebase/backend/test/auth-oauth-callback.e2e-spec.ts` (신규 e2e, 실 Postgres 사용)

배경: TypeORM 0.3.31 + pg 드라이버가 `UPDATE`/`DELETE ... RETURNING` 에 대해서만
`[rows, rowCount]` 튜플을 돌려주는데(SELECT/INSERT 는 행 배열), 8개 소비 지점이 이를
행 배열로 오인해 `.length`/`[0]`/`.map` 을 직접 적용해 왔다. 그 결과 admission cap 조건부
UPDATE, KB CAS 락 2곳, `updateExecutionStatus` guarded UPDATE, OAuth state 소비 확인이
**DB 쓰기 자체는 SQL WHERE 조건으로 안전했지만 애플리케이션이 결과를 항상 오판**하고
있었다. 이번 diff 는 신규 헬퍼 `updateReturningRows()` 로 이 shape 판별을 일원화해 8곳을
교체하고, 곁들여 `auth-oauth.service.ts` 의 raw 컬럼명(snake_case `remember_me`)을 entity
camelCase 로 잘못 읽던 별개 결함도 같은 커밋 계열에서 닫았다.

## 발견사항

- **[INFO]** `reEmbedAll` 의 CAS 락 UPDATE → 문서 reset UPDATE → (0행 시) idle 복귀
  UPDATE 세 단계가 단일 트랜잭션으로 묶여 있지 않다 (기존 구조, 이번 diff 는 shape
  처리만 교체 — 신규 도입 아님).
  - 위치: `codebase/backend/src/modules/knowledge-base/knowledge-base.service.ts:714-761`
    (`reEmbedAll` — CAS 락 `:720`, 문서 reset `:739`, 각각 독립된 `this.dataSource.query(...)`)
  - 상세: 같은 파일의 `reExtractAll`(`:327-390`)은 CAS 락 UPDATE·DELETE·문서 reset UPDATE·
    문서 ID 조회를 `this.dataSource.transaction(async (manager) => {...})`(`:334`) 안에
    전부 묶어 크래시 시 부분 적용을 막는다. `reEmbedAll` 은 동일한 CAS-lock-then-write
    패턴인데도 두 UPDATE 가 각자 독립 스테이트먼트라, CAS 락 UPDATE 가 커밋된 직후
    프로세스가 죽거나 두 번째 UPDATE 가 실패하면 그 KB 는 문서 하나도 재큐되지 않은 채
    `reembed_status='in_progress'` 로 좌초할 수 있다 — 이번 diff 가 정확히 고친 "빈 KB
    가 `in_progress` 로 영구 좌초" 증상과 같은 계열의 좌초를, 트랜잭션 경계 밖의 실패로도
    만들 수 있는 여지가 남는다. 이전 라운드(`review/code/2026/08/14/00_00_44/database.md`)
    에서 이미 지적·확인됐고 RESOLUTION(`review/code/2026/08/14/00_00_44/RESOLUTION.md`
    "ai INFO 22 / DB")에서 "기존 구조, plan 후속 대상"으로 넘겨져 있다 — 이번 세션에서
    재확인만 한다.
  - 제안: 조치 불요(스코프 밖, 이미 plan 후속에 등재). 다음에 이 함수를 손댈 기회가 있으면
    `reExtractAll` 과 동일하게 CAS 락 + reset 을 `dataSource.transaction()` 으로 묶는 것을
    고려.

- **[INFO]** 신규 e2e(`auth-oauth-callback.e2e-spec.ts`)의 "만료된 state" 케이스가 심은
  행이 테스트 안에서 소비/정리되지 않는다.
  - 위치: `codebase/backend/test/auth-oauth-callback.e2e-spec.ts:110-115`
    (`seedState(db, 'google', -60_000)` 로 이미 만료된 행을 삽입)
  - 상세: 프로덕션 코드의 `DELETE ... WHERE state = $1 AND expires_at > NOW()` 는 이미
    만료된 행을 애초에 매치하지 않으므로(의도된 동작), 이 테스트가 심은 행은 DELETE 되지
    않고 `auth_oauth_state` 테이블에 그대로 남는다. 다른 케이스(재사용·provider 불일치)는
    콜백 자체가 DELETE 를 태우므로 자연히 정리되지만, 이 케이스만 명시적 cleanup 이 없어
    반복 실행 시 테이블에 만료 행이 누적된다. e2e 가 매번 초기화되는 컨테이너/볼륨에서
    돈다면(`make e2e-down -v`) 실질 영향은 없지만, 영속 테스트 DB 에서 반복 실행되면
    작은 누적이 생긴다.
  - 제안: 필수 아님 — `afterAll`/해당 `it` 종료 시 `DELETE FROM auth_oauth_state WHERE
    state = $1` 로 명시 정리하거나, TTL 정리 배치가 이미 있다면(`purgeExpired` 등) 그
    커버리지에 기대는 것으로 충분.

## DB 관점 나머지 항목 평가

- **인덱스**: 이번 diff 는 WHERE 절·쿼리 텍스트를 바꾸지 않고 반환값 해석만 교체했다.
  `id`(PK)/`workspace_id`/`state`(entity 에 `unique: true`)/status 컬럼 조건은 기존
  그대로라 신규 인덱스 이슈 없음.
- **N+1**: 전부 단일 batch `UPDATE ... RETURNING` 문이며 반복문 내 개별 쿼리 실행 없음.
  KB 재큐도 `RETURNING id` 로 대상 id 를 한 번에 얻은 뒤 `CHUNK_SIZE` 단위로 `addBulk`
  하는 기존 패턴 그대로다. 해당 없음.
- **트랜잭션**: `admitExecutionOrDefer`(`execution-engine.service.ts` admission)는 advisory
  lock + 조건부 UPDATE 를 `executionRepository.manager.transaction(...)` 안에서 유지하고,
  `updateReturningRows` 가 비정상 shape 에 throw 하면 트랜잭션이 롤백돼 부분 적용을 막는다
  (주석에 의도 명시) — 올바르다. `reExtractAll` 도 트랜잭션 경계 유지. `reEmbedAll` 은 위
  INFO 참고(기존 구조). `updateExecutionStatus`(engine)의 guarded UPDATE 는 원래도 앱
  트랜잭션 밖이고 `WHERE status IN (...)` SQL 가드로 데이터 안전성을 지켜 왔다는 점이
  주석에 명시돼 있다 — 이번 수정은 "적용됐는지 앱이 아는가"만 고친다.
- **마이그레이션 안전성**: 스키마 변경 없음(`git diff --stat` 상 migration 파일 0건, DB
  디렉터리 diff 없음).
- **스키마 설계**: 테이블 구조·컬럼·관계 변경 없음. `auth-oauth.service.ts` 의
  `AuthOAuthStateRow` 인터페이스는 스키마 변경이 아니라 raw 쿼리 결과의 TS 타입을 실제
  DB 컬럼명(snake_case)에 맞춘 것뿐이며, entity(`auth-oauth-state.entity.ts`)의
  `@Column({ name: 'remember_me' })` 매핑과 대조해도 정확하다.
- **커넥션 관리**: TypeORM `DataSource.query`/`transaction`/`EntityManager.query` 표준
  경로만 사용, 수동 커넥션 획득/해제 없음. 신규 e2e 는 `pg.Client` 를 `beforeAll` 에서
  `connect()`, `afterAll` 에서 `end()` 해 누수 없이 정리한다.
- **SQL 인젝션**: 변경/신규 raw SQL 전부(`execution-engine.service.ts` admission UPDATE·
  `updateExecutionStatus` UPDATE, `knowledge-base.service.ts` CAS 락 2곳·재큐 2곳·reset,
  `auth-oauth.service.ts` DELETE, e2e `seedState` 의 INSERT)가 `$1`,`$2`,… 파라미터
  바인딩을 그대로 유지한다. 문자열 결합으로 바뀐 지점 없음 — 신규 SQL 인젝션 표면 없음.
- **대량 데이터**: KB 재큐/재추출 로직은 `RETURNING id` 로 전체 대상 id 를 한 번에 메모리에
  올린 뒤 `CHUNK_SIZE` 분할 적재하는 기존 패턴을 그대로 유지한다(이번 diff 는 그 배열을
  얻는 shape 해석만 교체) — 신규 회귀 없음.

## 헬퍼(`updateReturningRows`) 자체 검증

`Array.isArray(result[0])` 로 "튜플인가"를 판별하는 휴리스틱은 Postgres `RETURNING` 이
항상 행을 객체로 반환한다는 전제(행 자체가 배열일 수 없음) 위에서 안전하다.
`codebase/backend/src/common/utils/update-returning-rows.ts` JSDoc 에 드라이버 실측 근거
(`[[{id}],1]` / `[[],0]` / `[{id}]`)가 남아 있고, 8개 소비 지점 전수 뮤테이션(engine 2/2,
KB 5/5 사살)과 `update-returning-rows.spec.ts` 의 구조적 회귀 가드(정규식 기반 소비-지점
카운팅, `it.each(EXPECTED)`)로 재발 방지가 걸려 있다. 비-배열 입력에 `detail` 컨텍스트와
함께 throw 하는 fail-fast 설계도 admission 트랜잭션 롤백과 맞물려 안전하다.

## 요약

이번 변경은 새로운 DB 리스크를 도입하는 것이 아니라, TypeORM/pg 드라이버의 `UPDATE`/
`DELETE ... RETURNING` 반환 shape 오인으로 인해 실제로 죽어 있던 DB 레벨 동시성 제어
(admission cap 조건부 UPDATE, execution 짝 전이 guarded UPDATE, KB CAS 락 2곳, OAuth
state 단일 소비 확인)를 정상 작동시키는 수정이며, 곁들여 raw 쿼리의 snake_case 컬럼명을
entity camelCase 로 잘못 읽던 별개 결함(`remember_me`)도 올바르게 닫았다. 모든 쿼리는
파라미터화돼 있고, 스키마/마이그레이션 변경은 없으며, 트랜잭션 경계(advisory lock
admission gate, KB `reExtractAll`)는 그대로 유지되고 헬퍼가 throw 하면 올바르게 롤백된다.
유일하게 반복 확인되는 잔여 사항은 `reEmbedAll` 의 CAS 락 UPDATE 와 문서 reset UPDATE 가
단일 트랜잭션으로 묶여 있지 않다는 점으로, 이는 이번 diff 이전부터 있던 구조이고 이미
plan 후속 항목으로 추적되고 있어 이번 PR 을 막을 사유는 아니다. 신규 e2e 의 "만료 state"
케이스가 테스트 DB 에 행을 남기는 것도 저위험 test-hygiene 관찰(INFO)일 뿐이다.
CRITICAL/WARNING 급 DB 결함 없음.

## 위험도

LOW
