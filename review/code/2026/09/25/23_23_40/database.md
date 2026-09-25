# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 새 가시성 조건(`scope`, `created_by`)에 대한 전용 인덱스 없음
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:517` (`findAll` — `andWhere(integrationVisibilityClause('i'), ...)`), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:173` (`listIntegrations`)
  - 상세: `integration` 엔티티(`codebase/backend/src/modules/integrations/entities/integration.entity.ts`)의 기존 인덱스는 `('workspace_id','name')` UNIQUE 와 `('workspace_id','status')` 뿐이다. 새로 추가된 `(i.scope <> 'personal' OR i.created_by = :userId)` 조건은 `scope`/`created_by` 어느 쪽도 인덱스에 없다. `workspace_id` 선두 컬럼으로 이미 필터링된 뒤 남은 소수 행을 스캔하는 구조라 워크스페이스당 통합 개수가 적은 현재 스케일에서는 문제가 되지 않지만, 워크스페이스당 통합 수가 크게 늘어나는 시나리오에서는 이 조건이 인덱스를 못 타 시퀀셜/필터 비용이 늘어난다.
  - 제안: 현재는 조치 불필요. 다만 워크스페이스당 통합 행 수가 앞으로 대폭 늘 것으로 예상되면 `(workspace_id, scope, created_by)` 복합 인덱스 추가를 고려.

- **[INFO]** `integration-visibility.ts` 는 신규 스키마 변경이 아니라 기존 컬럼(`scope`, `created_by`) 위에 판정 로직만 추가 — 마이그레이션 리스크 없음(확인 목적 기록)
  - 위치: `codebase/backend/src/modules/integrations/entities/integration.entity.ts` (변경 파일 목록에 미포함, 사전 존재 컬럼)
  - 상세: 이번 diff 에 스키마 마이그레이션 파일이 없다. `scope`(§49)·`created_by`(§131) 컬럼은 이번 PR 이전부터 존재했고, 이번 변경은 애플리케이션 레이어의 가시성 판정(`isIntegrationVisibleTo`)과 그 SQL 표현(`integrationVisibilityClause`)을 추가한 것뿐이다. 무중단 배포 관점에서 위험 없음.

## 긍정적으로 확인한 패턴 (참고)

- **N+1 없음**: `findAll`/`listIntegrations` 모두 가시성 조건을 애플리케이션 필터가 아니라 단일 SQL `andWhere` 절로 밀어 넣어(`integrations.service.ts:513-519`, `explore-tools.service.ts:169-175`) 목록 조회 1건으로 처리하고, 페이지네이션 `total`/`limit` 도 남의 personal 을 세지 않도록 SQL 단에서 걸러낸다(`integrationVisibilityClause` 주석에 이 이유가 명시됨).
- **SQL 인젝션**: `integrationVisibilityClause(alias)` 는 `alias` 를 문자열 템플릿에 직접 삽입하지만, 두 호출부(`integrations.service.ts:517`, `explore-tools.service.ts:173`) 모두 하드코딩 리터럴 `'i'`만 넘겨 사용자 입력이 개입할 여지가 없다. 값(`userId`)은 TypeORM `:integrationUserId` 파라미터 바인딩으로 전달돼 파라미터화가 유지된다.
- **동시성/정합성(Lost Update 방지)**: `update`/`updateScope`/`remove`/`reauthorize` 경로는 엔티티 `save()` 대신 판정 근거(`id`,`workspaceId`,`scope`)를 조건으로 건 조건부 `repository.update()`/`delete()`(compare-and-set)로 바꿔, 판정 이후 다른 요청이 `scope` 를 바꾼 경우 0-row 로 실패시키고 재조회 후 404 처리한다(`integrations.service.ts` `judgedRow`/`reloadOrNotFound`). `rotate()`와 OAuth 콜백(`integration-oauth.service.ts:801-868`)은 `dataSource.transaction` + `pessimistic_write` 락 안에서 재조회·재판정(`assertRequesterStillAllowed`, `isIntegrationVisibleTo`)을 커밋 직전에 다시 수행해 TOCTOU(락 획득 전후 `scope`/역할 변경) 를 차단한다. 락 구간 안에서는 엔티티 `save()`(rotate 콜백)를 그대로 써도 안전함을 주석으로 근거 제시.
- **커넥션 관리**: 신규 e2e(`test/integration-personal-owner.e2e-spec.ts`)는 `pg.Client` 를 `beforeAll`에서 `connect()`, `afterAll`에서 `db.end()`로 해제하고, raw 쿼리(`SELECT id FROM workspace_member WHERE ... $1 AND ... $2`)도 파라미터 바인딩을 사용한다.
- **대량 데이터**: `findAll` 목록 조회는 여전히 `page`/`limit` 기반 페이지네이션을 유지하며, 가시성 필터를 메모리가 아닌 SQL로 옮긴 것 자체가 대용량 대응 개선(설계 의도가 코드 주석에 명시됨).

## 요약

이번 변경은 Personal/Organization 통합 가시성·인가 판정을 도입하는 리팩터링으로, 핵심 DB 관점 위험(SQL 인젝션, N+1, 트랜잭션 정합성, lost update, 커넥션 누수, 마이그레이션 안전성)은 모두 적절히 처리되어 있다. 새 필터 조건(`scope`,`created_by`)에 전용 인덱스가 없다는 점만 INFO 로 남기며, 현재 스케일에서는 실질적 성능 영향이 없을 것으로 판단된다. 스키마 변경(마이그레이션)은 포함되지 않았고 기존 컬럼을 재사용했다.

## 위험도

NONE
