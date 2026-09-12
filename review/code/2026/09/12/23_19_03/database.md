# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 파라미터화된 쿼리는 그대로 유지된다 — 이 변경은 SQL 인젝션 방어가 아니라 22P02 마스킹 방지
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts:65` (`if (!isUuidShaped(id)) return null;`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts:178` (`if (!isUuidShaped(parsed.i)) { throw new Error(...) }`)
  - 상세: 두 `decodeCursor` 모두 검증 전후로 커서 id 는 TypeORM `QueryBuilder` 의 named parameter(`:cursorId`, `:lastId`)로만 바인딩된다(`login-history.service.ts:123`의 `qb.andWhere('(lh.created_at, lh.id) < (:cursorTs, :cursorId)', { cursorTs, cursorId: cursor.id })`, `background-runs.service.ts:266`의 `qb.andWhere('...ne.id > :lastId)', { lastStartedAt, lastId: cursor.i })`). 즉 수정 전에도 문자열 이어붙이기(concatenation)로 SQL 을 구성한 적이 없어 인젝션 경로 자체가 없었다 — 이번 결함은 "타입이 안 맞는 값이 파라미터화된 자리에 바인딩되어 Postgres 가 SQLSTATE 22P02 로 거부"하는 문제였지, 인젝션이 아니었다. `isUuidShaped` 도입은 그 바인딩 전에 값을 필터링해 불필요한 DB 왕복(파싱 실패로 끝나는 쿼리 실행)을 막는 부수 효과가 있다.
  - 제안: 없음 — 확인 목적의 기록. 파라미터화 유지가 이번 변경으로 깨지지 않았음을 검증했다.

- **[INFO]** 대량 데이터 페이지네이션 — keyset(cursor) 방식이 유지되고 OFFSET 기반으로 퇴행하지 않았다
  - 위치: `codebase/backend/src/modules/auth/login-history.service.ts` `findForUser` (`orderBy('lh.created_at','DESC').addOrderBy('lh.id','DESC').take(limit+1)` + `(lh.created_at, lh.id) < (:cursorTs,:cursorId)`), `codebase/backend/src/modules/executions/background-runs/background-runs.service.ts` `fetchBodyPage`
  - 상세: `login_history`·`node_execution` 모두 시간이 지나며 커질 수 있는 테이블인데, 두 쿼리 다 튜플 비교 기반 keyset pagination 을 쓰고 있어 `OFFSET` 스캔 비용 문제가 없다. 이번 diff 는 이 패턴을 바꾸지 않고 id 검증만 앞에 추가했다.
  - 제안: 없음.

- **[INFO]** (참고, 이 diff 의 범위 밖) `login_history` 의 keyset 정렬 키는 `(created_at, id)` 튜플인데 기존 인덱스는 `idx_login_history_user_created (user_id, created_at)` 뿐이다
  - 위치: `codebase/backend/src/modules/auth/entities/login-history.entity.ts` (`@Index('idx_login_history_user_created', ['userId','createdAt'])`) — 이번 PR 에서 수정된 파일이 아니다.
  - 상세: `findForUser` 는 `(lh.created_at, lh.id) < (:cursorTs, :cursorId)` 로 2번째 tie-breaker(`id`)까지 비교하지만 인덱스에는 `id` 가 없다. 동일 사용자의 `created_at` 이 밀리초 단위로 거의 겹치지 않는 한 실무 영향은 작지만, 대량 동시 로그인 이벤트(배치 처리 등)로 같은 타임스탬프가 몰리면 인덱스만으로 정확한 순서를 못 정해 추가 필터링 비용이 생길 수 있다. 이번 변경이 만든 문제는 아니고 사전에 존재하던 스키마 상태다.
  - 제안: 필요 시 별도 항목으로 `idx_login_history_user_created` 를 `(user_id, created_at, id)` 3-컬럼으로 확장하는 것을 고려(이번 PR 범위 아님, 후속 검토용 참고).

- **[INFO]** `isUuidShaped` 정규식은 고정 길이·비-중첩 패턴이라 ReDoS 위험이 없다
  - 위치: `codebase/backend/src/common/utils/uuid.ts` (`UUID_SHAPE_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i`) — 신규 파일 아님, 기존 함수를 재사용.
  - 상세: DB 바인딩 직전 게이트로 쓰이는 이 술어가 선형 시간에 끝나므로, 이 검증 자체가 새로운 DoS 표면이 되지 않는다.
  - 제안: 없음.

## 요약

이 변경은 keyset 커서의 id 성분(`LoginHistory.id`, `NodeExecution.id` — 둘 다 `uuid` 컬럼)이 검증 없이 파라미터화된 쿼리에 바인딩되어 Postgres 가 SQLSTATE 22P02 로 거부하고 `GlobalExceptionFilter` 가 이를 500 으로 마스킹하던 결함을 각 디코더에 `isUuidShaped` 검증을 추가해 막는다. 스키마 변경·마이그레이션·트랜잭션·N+1·커넥션 풀 관련 변경은 없으며, 두 쿼리 모두 수정 전후 일관되게 named parameter 바인딩을 사용해 SQL 인젝션 경로가 없었다(이번 결함은 인젝션이 아니라 타입 불일치로 인한 500 마스킹). 대용량 테이블 대응인 keyset pagination 패턴도 그대로 유지된다. DB 관점에서 이 diff 자체에 새로 도입된 리스크는 없다. 참고로 `login_history` 의 keyset 정렬 키(`created_at, id`)와 기존 인덱스(`user_id, created_at`)가 완전히 일치하지 않는 사전 존재 상태를 INFO 로 남겼으나 이번 PR 의 결함은 아니다.

## 위험도

NONE
