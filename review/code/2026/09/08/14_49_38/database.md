# 데이터베이스(Database) 코드 리뷰

## 검토 범위

이번 diff(B-1~B-8, 3커밋)에서 DB 관점으로 실질적 의미가 있는 자리는 다음 다섯 곳이다.

1. `codebase/backend/src/modules/workspaces/workspaces.service.ts` — `listMembers` 를 `relations: ['user']`(JOIN) + JS `.map()` 수동 투영에서 TypeORM `select` 옵션 기반 **DB 레벨 컬럼 투영**으로 전환
2. `codebase/backend/src/common/filters/http-exception.filter.ts` — 로컬 `isUniqueViolation`(QueryFailedError 로 wrap 된 표면만 검사)을 SoT `isPostgresUniqueViolation`(raw `err.code` + `err.driverError.code` 두 표면)으로 교체
3. `codebase/backend/src/modules/integrations/integration-oauth.service.ts` — 손으로 짠 constraint 추출 표현식을 `pgErrorConstraint()` 공용 헬퍼로 치환(cafe24/makeshop 두 자리)
4. `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` — `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 타입 개명(순수 타입 리네임, 쿼리·`select` 투영 자체는 이 PR 이전부터 존재)
5. `codebase/backend/test/webhook-trigger.e2e-spec.ts` B4 — `(workspace_id, endpoint_path)` UNIQUE 위반이 실제 Postgres 에서 409 로 매핑되는지 확인하는 신규 e2e

`codebase/backend/migrations/**` · `*.entity.ts` 는 이번 diff 에서 변경되지 않았다(`git diff --stat origin/main...HEAD` 로 확인, 매치 0건) — 스키마·마이그레이션 안전성 검토 대상 자체가 없다.

## 발견사항

- **[INFO]** `listMembers` DB 레벨 투영 전환 — 긍정적 변경, 회귀 리스크 낮음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` (`listMembers`, `select: { id, userId, role, joinedAt, user: { id, email, name } }` 블록)
  - 상세: 종전에는 `relations: ['user']` 로 `User` 엔티티 전 컬럼(비밀번호 해시·2FA 시크릿 등 민감 7컬럼 포함, `spec/1-data-model.md §2.1.1`)을 JOIN 으로 로드한 뒤 JS `.map()` 으로 6키만 추려 반환했다. 이번 변경은 TypeORM `select` 옵션으로 `user` 관계의 컬럼을 `{ id, email, name }` 세 개로 DB 레벨에서 좁힌다. `relations` 를 문자열 배열(`['user']`)로 주고 `select.user` 를 중첩 객체로 주는 조합이 실제로 동작하는지 확인하려고 `typeorm@0.3.31` 의 `SelectQueryBuilder.applyFindOptions()` 를 직접 열어봤다 — `OrmUtils.propertyPathsToTruthyObject(this.findOptions.relations)` 로 배열을 객체(`{ user: true }`)로 정규화한 뒤 `buildRelations(relations, select, ...)` 에 그대로 넘기므로, 배열 형태 `relations` + 객체 형태 `select` 조합은 TypeORM 내부에서 지원되는 정상 경로다(런타임에서 select 가 무시되거나 예외가 나는 형태가 아니다). 단일 쿼리(JOIN)로 처리되어 N+1 로 퇴화하지 않는다. `workspaceId` 조회 조건은 `@Unique(['workspaceId', 'userId'])` 복합 유니크 제약(선두 컬럼 `workspace_id`)이 이미 커버하므로 인덱스 누락도 아니다.
  - 제안: 조치 불요. 다만 이 select+relations 조합의 런타임 정합성은 실제 Postgres 를 도는 `workspace-rbac.e2e-spec.ts` J.(`GET /:id/members`) 가 유일한 실측 검증 지점이다 — 이 PR 을 머지하기 전 그 e2e 가 실제로(mock 이 아니라) 그린임을 한 번은 확인해 둘 것을 권한다(harness-only 세션에서는 backend e2e 가 스킵될 수 있다는 이 저장소 기록이 있다).

- **[INFO]** 전역 예외 필터의 unique violation 판정 확장 — SQLSTATE 두 표면 통합, DB 에러 매핑의 정확도 개선
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts`(`isUniqueViolation` 제거, `isPostgresUniqueViolation` 사용), `codebase/backend/src/common/db/pg-error.ts`(변경 없음, SoT)
  - 상세: 종전 로컬 판정은 `err instanceof QueryFailedError` 를 먼저 요구해 TypeORM 이 wrap 하지 않은 raw `err.code === '23505'` 표면을 통째로 놓쳤다(500 으로 오분류). 새 헬퍼는 `err.code ?? err.driverError?.code` 두 표면을 모두 본다. DB 에러를 HTTP 상태로 매핑하는 로직이 파일마다 흩어지지 않고 SoT(`pg-error.ts`)로 집중된 것은 바람직한 방향이다. `http-exception.filter.spec.ts` 신규 테스트 두 건(raw 23505→409, raw 23502→500)이 양방향 회귀를 고정한다.
  - 제안: 조치 불요.

- **[INFO]** `pgErrorConstraint()` SoT 재사용 — 중복 제거, 동작 동일
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (두 자리, cafe24/makeshop 각각)
  - 상세: 손으로 짠 `(err as {...})?.constraint ?? (err as {...})?.driverError?.constraint` 표현식을 `pg-error.ts` 의 `pgErrorConstraint(err)` 로 치환했다. `pg-error.ts` 자체는 diff 밖(변경 없음)이며 의미상 동등(둘 다 `constraint ?? driverError?.constraint`)하다. 파라미터화된 TypeORM API 만 쓰며 raw SQL 문자열 조립이 없어 SQL 인젝션 우려도 없다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e(B4) — mock 이 아닌 실제 DB UNIQUE 제약 회귀 고정
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` (`'B4. 같은 워크스페이스에 같은 endpointPath → 409 ...'`)
  - 상세: `triggers.service.spec.ts` 는 `QueryFailedError` 를 손으로 구성해 단위 테스트를 돌리는데, 실제 Postgres 가 그 형태(SQLSTATE·제약 이름)를 정말 그렇게 돌려주는지는 mock 이 원리적으로 검증할 수 없다. 이 e2e 는 실제 `(workspace_id, endpoint_path)` 부분 UNIQUE 인덱스(마이그레이션 `V102`/`V103`, 이번 diff 밖)를 실제로 두 번째 트리거 생성으로 충돌시켜 409 + `details.code='TRIGGER_ENDPOINT_PATH_CONFLICT'` 를 확인하고, 드라이버 원문(`duplicate key`)이 응답에 새지 않는지도 함께 검증한다. DB 에러 마스킹 계약을 실측으로 검증하는 좋은 추가다.
  - 제안: 조치 불요.

- **[INFO]** `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명 — 순수 타입 리네임, 쿼리 변경 없음
  - 위치: `codebase/backend/src/modules/workflow-versions/workflow-versions.service.ts` (`findOne` 반환 타입)
  - 상세: `findOne` 의 `select` 투영(`id, workflowId, version, changeSummary, snapshot, createdBy, createdAt, creator: CREATOR_PROJECTION`)은 이 PR 이전부터 이미 존재했고 이번 diff 로 바뀌지 않았다. DB 쿼리·투영 범위에 실질 변경이 없는 타입 이름 변경이다.
  - 제안: 조치 불요.

## 요약

이번 배치의 DB 관련 변경은 전부 기존 동작을 안전한 방향으로 좁히거나(불필요한 `User` 민감 컬럼 로드 제거, unique violation 판정을 SoT 헬퍼로 통합) 실제 DB 제약을 mock 이 아닌 e2e 로 검증을 보강하는 성격이다. 마이그레이션·엔티티 파일은 이번 diff 에서 전혀 건드리지 않아 무중단 배포 안전성 검토 대상 자체가 없다. `listMembers` 의 `relations`(배열) + `select`(중첩 객체) 조합은 TypeORM 0.3.31 소스를 직접 열어 내부적으로 배열이 객체로 정규화되어 select 에 전달됨을 확인했으므로 기술적으로 유효하며, JOIN 단일 쿼리로 처리되어 N+1 도 아니다. 트랜잭션이 필요한 다중-스테이트먼트 쓰기 로직이나 신규 인덱스가 필요한 쿼리, 파라미터화되지 않은 raw SQL 도 발견되지 않았다. 유일하게 남기는 권고는 절차적인 것 — 실제 Postgres 를 도는 `workspace-rbac.e2e-spec.ts` J. 와 신규 `webhook-trigger.e2e-spec.ts` B4 가 이번 PR 머지 전에 실제로(mock 이 아니라) 그린임을 한 번은 확인하는 것이다.

## 위험도

NONE
