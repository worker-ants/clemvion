### 발견사항

- **[INFO]** V052 마이그레이션: CHECK 제약 DROP+ADD 패턴은 PostgreSQL에서 짧은 ACCESS EXCLUSIVE lock 발생
  - 위치: `backend/migrations/V052__notification_type_integration_action_required.sql` 라인 8-9
  - 상세: `ALTER TABLE notification DROP CONSTRAINT IF EXISTS notification_type_check` 뒤 즉시 `ADD CONSTRAINT`를 실행하는 패턴은 각각 짧은 ACCESS EXCLUSIVE lock을 획득한다. PostgreSQL 12+ 기준 CHECK NOT VALID + VALIDATE CONSTRAINT 2단계 패턴을 쓰면 VALIDATE 단계에서 ShareUpdateExclusiveLock으로 강등되어 DML 차단 없이 운영 중 적용 가능하다. 다만 notification 테이블 INSERT 빈도와 테이블 크기에 따라 현행 방식도 무중단 수준일 수 있으며, 이 마이그레이션 자체는 운영 결함(check_violation으로 INSERT 실패) 수정이므로 적용 시점 협의가 선행되어야 한다.
  - 제안: 트래픽이 낮은 시간대 적용 또는 `ADD CONSTRAINT ... NOT VALID` 후 `VALIDATE CONSTRAINT` 2단계 방식 검토.

- **[INFO]** V053 마이그레이션: `CREATE INDEX CONCURRENTLY`와 `.conf executeInTransaction=false` 올바르게 설정됨
  - 위치: `backend/migrations/V053__notification_workspace_type_resource_idx.sql`, `V053__notification_workspace_type_resource_idx.conf`
  - 상세: `CONCURRENTLY` 사용과 Flyway `executeInTransaction=false` 설정이 함께 명시되어 있어 무중단 인덱스 생성 요건을 충족한다. `IF NOT EXISTS` 절이 있어 재실행 안전성도 갖추었다.
  - 제안: 현행 방식 적절. 추가 조치 불필요.

- **[INFO]** V053 복합 인덱스 컬럼 순서 적절성 검토
  - 위치: `backend/migrations/V053__notification_workspace_type_resource_idx.sql` 라인 12-13
  - 상세: `(workspace_id, type, resource_id, created_at DESC)` 순서는 쿼리의 `WHERE workspace_id=$1 AND type=$2 AND resource_id=$3 AND created_at>=$4` 조건에 부합한다. `title` 컬럼은 인덱스에 미포함이지만, `workspace_id/type/resource_id/created_at` 4개 컬럼으로 필터링 후 `title`을 heap에서 재확인하는 비용은 일반적으로 허용 범위다. `title`이 높은 선택도를 가질 경우 인덱스에 포함하면 추가 이득을 볼 수 있으나 현재 설계도 합리적이다.
  - 제안: 운영 후 `EXPLAIN ANALYZE`로 index scan 효율 확인. 필요시 `title` 포함 인덱스로 교체 검토.

- **[INFO]** statistics.service.ts: 중복 쿼리 → 단일 QueryBuilder로 통합 (W-21 조치)
  - 위치: `backend/src/modules/statistics/statistics.service.ts` 라인 83-147
  - 상세: 기존에는 `workflowId` 유무에 따라 동일 구조의 쿼리를 두 번 만들어 분기 실행했으나, 이제 하나의 QueryBuilder에 조건부 `andWhere`를 붙여 단일 쿼리로 통합하였다. 쿼리 수가 2→1로 줄었고 코드 중복도 제거되었다. 올바른 리팩토링이다.
  - 제안: 현행 방식 적절.

- **[INFO]** executions.service.ts: `MAX_EXECUTION_PATH_ROWS = 10_000` 상한 적용 (W-22 조치)
  - 위치: `backend/src/modules/executions/executions.service.ts` 라인 920-938
  - 상세: `execution_node_log`를 `take: MAX_EXECUTION_PATH_ROWS`로 제한하여 대량 ForEach 실행 시 메모리 폭증을 방어한다. 단, 10,000건을 초과하는 실행에서는 executionPath가 잘려 UI timeline이 불완전해지며 사용자에게 별도 안내는 없다. 이 부분은 코드 주석에 명시되어 있고, 내부 timeline 표시 용도에 한해 허용된 트레이드오프다.
  - 제안: 현행 방식 적절. 향후 UX 개선 시 "일부 경로 생략" 안내 추가 고려.

- **[INFO]** PaginationQueryDto.sort 필드 식별자 패턴 검증 추가 (W-46 조치)
  - 위치: `backend/src/common/dto/pagination.dto.ts` 라인 640-647
  - 상세: `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + `@MaxLength(64)` 로 sort 파라미터를 영문/숫자/밑줄 식별자로 제한하여 ORDER BY 인젝션 1차 방어를 DTO 레벨에 추가하였다. 이 패턴은 서비스 계층의 화이트리스트(`getSortColumn`)와 함께 다층 방어를 구성한다.
  - 제안: 현행 방식 적절. 서비스 계층 화이트리스트가 최종 방어선임을 유지할 것.

### 요약

이번 변경에서 데이터베이스 관련 핵심 작업은 V052(notification.type CHECK 제약 갱신)와 V053(복합 인덱스 신설) 두 마이그레이션이다. V053은 `CONCURRENTLY`와 Flyway `executeInTransaction=false`를 올바르게 조합하여 무중단 인덱스 추가 요건을 갖추었고, 인덱스 컬럼 순서도 실제 쿼리 패턴에 부합한다. V052는 DROP+ADD CHECK 패턴으로 인해 짧은 ACCESS EXCLUSIVE lock이 발생하나, 이는 운영 결함(INSERT 실패) 수정을 위한 조치로 낮은 트래픽 시간대 적용을 권장한다. statistics.service.ts의 중복 쿼리 통합과 executionPath 조회 상한 적용은 쿼리 효율과 메모리 안전성을 동시에 개선한 양호한 변경이며, PaginationQueryDto의 sort 패턴 검증은 ORDER BY 인젝션 방어를 강화하였다. 전반적으로 DB 관련 변경은 올바른 방향이며 CRITICAL 또는 WARNING 수준의 결함은 없다.

### 위험도
LOW
