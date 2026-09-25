# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 신설 가시성 필터에 전용 복합 인덱스 없음 (허용 가능한 위험)
  - 위치: `codebase/backend/src/modules/integrations/integrations.service.ts:509-513` (`findAll`), `codebase/backend/src/modules/integrations/integration-visibility.ts:37-39` (`integrationVisibilityClause`), `codebase/backend/src/modules/workflow-assistant/tools/explore-tools.service.ts:170-175` (`listIntegrations`)
  - 상세: `WHERE workspace_id = :w AND (scope <> 'personal' OR created_by = :u)` 형태로 목록 쿼리에 가시성 조건이 추가됐다. 기존 인덱스는 `idx_integration_workspace_status (workspace_id, status)` 뿐이라 `workspace_id` 까지는 leftmost prefix 로 인덱스를 타지만, 그 뒤의 `scope`/`created_by` 필터는 인덱스 없이 workspace 내부 행을 순차 평가한다.
  - 제안: 워크스페이스당 통합 개수가 (경험상) 수십 건 수준이라 즉시 조치는 불필요하다고 판단한다 — 다만 향후 대규모 워크스페이스가 생기면 `(workspace_id, scope, created_by)` 복합 인덱스를 검토할 근거로 남긴다. 지금 당장 마이그레이션을 추가할 필요는 없음.

- **[INFO]** (참고, 결함 아님) `integrationVisibilityClause` 는 문자열 보간이지만 인젝션 경로 없음
  - 위치: `codebase/backend/src/modules/integrations/integration-visibility.ts:37-39`
  - 상세: `alias` 인자를 SQL 문자열에 그대로 삽입한다. 호출부를 전수 확인한 결과(`integrations.service.ts:511`, `explore-tools.service.ts:173`, 두 스펙 파일) 모두 하드코딩 리터럴 `'i'` 만 넘기고, 실제 값 바인딩은 `:${INTEGRATION_USER_PARAM}` 파라미터로 처리한다. 사용자 입력이 `alias` 로 들어오는 경로는 없다 — SQL 인젝션 위험 없음.

## 확인한 양호 사항 (참고용, 조치 불요)

- **트랜잭션/커넥션 재사용**: `IntegrationOAuthService`(콜백 재판정, `assertRequesterStillAllowed`)와 `IntegrationsService.rotate`(락 안 역할 재조회) 모두 `pessimistic_write` 락을 쥔 같은 트랜잭션의 `EntityManager` 를 `WorkspacesService.getMemberRole(..., manager)` 에 그대로 넘겨 커넥션 풀에서 두 번째 커넥션을 빌리지 않는다(`integration-oauth.service.ts:805-824`, `workspaces.service.ts:116-127`). 락 보유 중 별도 커넥션을 빌리면 풀 고갈·데드락 위험이 생기는데 이를 정확히 피했다 — 이전 라운드(`a8b5c8b13`)에서 지적·수정된 항목이 현재 코드에 반영돼 있음을 재확인했다.
- **낙관적 동시성(compare-and-set)**: `update`/`remove`/`updateScope`/reauthorize 의 non-oauth 분기가 TypeORM 엔티티 `save()` 대신 `judgedRow`(판정 근거 컬럼 포함 WHERE) + `update()`/`delete()` 조건부 단일 문장을 쓴다(`integrations.service.ts:834-838, 901-903, 1427-1431, 1473-1477`). `save()` 는 메모리 스냅샷과 DB 를 비교해 컬럼을 쓰므로 그 사이 다른 요청이 바꾼 `scope` 를 되돌리는 lost-update 가 날 수 있는데, 조건부 쓰기 + `affected === 0` → 404 처리로 이를 막는다. 삭제 조건에도 `scope` 를 포함시켜(`DELETE ... WHERE id=$1 AND workspace_id=$2 AND scope=$3`) 판정 이후 scope 가 바뀐 레코드를 잘못 지우는 경로를 차단한다.
- **파라미터화**: 새로 추가된 e2e 스펙의 원시 SQL(`test/integration-personal-owner.e2e-spec.ts` — `SELECT id FROM workspace_member WHERE workspace_id = $1 AND user_id = $2`)도 바인드 파라미터를 쓴다. 전 범위에서 SQL 인젝션 패턴 없음.
- **락 필요 판단**: `remove()` 는 락 대신 원자적 `DELETE` 의 `affected` 로 동시 삭제를 판별하고, `rotate`/OAuth 콜백은 `pessimistic_write` 를 쓰는 등 형제 경로마다 처방이 다르지만 각 주석이 근거(외부 호출 유무·판정 근거 컬럼 포함 여부)를 명시하고 있어 임의로 갈린 것이 아니다.
- **마이그레이션**: 이번 diff 에 스키마 변경(신규 마이그레이션 파일)이 없다. `scope`/`created_by`/`mall_id` 컬럼과 관련 인덱스(`idx_integration_workspace_status`, `(workspace_id, mall_id)` partial unique 등)는 모두 기존 스키마이며, 이번 변경은 그 위에 애플리케이션 레벨 가시성 판정만 추가한다. 무중단 배포 관점에서 lock/데이터 손실 위험 없음.
- **N+1**: `CandidateLookupService.fillCandidates`/`AssistantToolRouter`/`ExploreToolsService` 는 모두 `workspaceId`/`userId` 를 그대로 관통시키는 파라미터 배선일 뿐, 반복문 안에서 개별 쿼리를 새로 추가하지 않았다(`fillCandidates` 의 `Promise.all` 배치 패턴은 기존 구조 그대로).

## 요약

이번 변경은 통합(Integration) 개인/조직 스코프 가시성 규칙(spec §8)을 서비스·SQL 양쪽에 일관되게 적용하는 작업으로, DB 관점에서는 이미 전 3라운드 리뷰(`a8b5c8b13` 등)를 거치며 커넥션 재사용·낙관적 동시성 이슈가 선제적으로 수정되어 있었다. 목록 쿼리에 추가된 가시성 조건에 전용 인덱스가 없다는 점만 INFO 로 남기며, 이는 워크스페이스당 통합 수 규모를 고려할 때 즉시 조치가 필요한 수준은 아니다. SQL 인젝션·트랜잭션·마이그레이션·N+1 등 나머지 관점에서는 Critical/Warning 급 결함을 발견하지 못했다.

## 위험도

LOW
