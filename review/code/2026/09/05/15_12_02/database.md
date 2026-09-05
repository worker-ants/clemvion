# 데이터베이스(Database) 리뷰

## 범위 요약

이번 변경 셋에서 DB 와 관련된 실질 코드는 `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`
(및 그에 대응하는 `audit-logs.spec.ts` 단위 테스트) 하나뿐이다. `AuditLogsService.findAll` 의
쿼리를 `leftJoinAndSelect('al.user', 'user')`(User 엔티티 전 컬럼 로드) 에서
`leftJoin('al.user', 'user').addSelect(['user.id', 'user.name', 'user.email'])`(3필드만 로드)
로 바꾼 것이 핵심이다. 나머지 파일(CHANGELOG, `response-contract.ts`/`.spec.ts`, 각 e2e 스펙,
`plan/`·`review/` 산출물)은 DB 스키마·쿼리·트랜잭션과 무관하다 — e2e 스펙에 추가된 것은
`assertMatchesContract` 호출(런타임 객체 형태 대조)뿐이고 새 DB 쿼리나 커넥션 사용은 없다.

## 발견사항

- **[INFO]** `addSelect` 로 좁힌 조인은 DB 관점에서 순정 개선이다 — 인덱스·N+1·트랜잭션·인젝션 문제 없음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:60-61` (`.leftJoin('al.user', 'user').addSelect(['user.id', 'user.name', 'user.email'])`)
  - 상세: 확인한 항목들.
    - **N+1**: 단일 쿼리에 `leftJoin` 으로 유지되어 있어 N+1 로 퇴행하지 않았다(반복문 내 개별 쿼리 없음).
    - **SQL 인젝션**: `addSelect` 배열은 사용자 입력이 아닌 하드코딩 문자열이고, 나머지 필터(`workspaceId`·`action`·`resourceType`·`userId`·`startDate`·`endDate`)는 전부 `:param` 파라미터 바인딩을 그대로 유지한다. `order`/`sort` 는 이 diff 가 건드리지 않은 `PaginationQueryDto` 에서 이미 `@IsIn(['asc','desc'])` + `@Matches(/^[a-zA-Z][a-zA-Z0-9_]*$/)` + 서비스단 화이트리스트(`getSortColumn`)로 이중 방어되어 있어 `order.toUpperCase() as 'ASC'|'DESC'` 캐스트가 실제 인젝션 벡터가 되지 않는다.
    - **인덱스**: `workspace_id`+`created_at` 필터/정렬 조합은 `codebase/backend/migrations/V002__indexes.sql:33` 의 `idx_audit_log_workspace_created (workspace_id, created_at DESC)` 복합 인덱스로 이미 커버된다. 이 diff 는 필터 조건을 바꾸지 않았으므로 인덱스 커버리지에 변화 없음.
    - **마이그레이션**: 스키마 변경 없음(select 절만 변경) — 무중단 배포 리스크 없음.
    - **커넥션 관리**: NestJS `@InjectRepository` 로 주입된 `Repository<AuditLog>` 를 그대로 사용, 커넥션 풀은 TypeORM 이 관리 — 변경 없음.
    - **트랜잭션**: `findAll` 은 읽기 전용 2쿼리(`getCount()` + `getMany()`) 조합으로 이 diff 이전과 동일한 패턴이며 이 변경으로 새로 도입된 정합성 리스크는 없다.
  - 제안: 없음. 이 변경은 그대로 유지 권장.

- **[INFO]** (참고, 이 diff 범위 밖) `action`/`resource_type`/`user_id` 단독 필터에는 전용 인덱스가 없다
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts` (전체 파일, `@Index` 데코레이터 0건) / `codebase/backend/migrations/V002__indexes.sql:33`
  - 상세: `getSortColumn` 화이트리스트가 `created_at`·`action`·`resource_type` 정렬을 허용하고 `andWhere` 필터도 `action`/`resourceType`/`userId` 를 단독으로 걸 수 있는데, 등록된 인덱스는 `(workspace_id, created_at DESC)` 뿐이다. `workspace_id` 로 먼저 좁혀지므로 워크스페이스당 로그량이 작으면 문제가 되지 않지만, 특정 워크스페이스의 감사 로그가 대량으로 누적되면 `action`/`resource_type`/`user_id` 필터 조합이 시퀀셜 스캔으로 흐를 수 있다. **이 diff 가 도입한 문제는 아니며 기존 상태다** — 참고용으로만 남긴다.
  - 제안: (선택) 트래픽 프로파일을 보고 필요 시 `(workspace_id, action)`, `(workspace_id, user_id)` 등 추가 복합 인덱스를 별도 plan 항목으로 검토.

## 요약

이번 diff 의 DB 관련 실질 변경은 감사 로그 목록 조회에서 `leftJoinAndSelect` → `leftJoin`+`addSelect` 전환 하나이며, 이는 보안 유출(User 엔티티 26개 컬럼 노출)을 막기 위한 컬럼 축소로 DB 관점에서도 전송량 감소라는 부수 이득이 있을 뿐 새로운 인덱스 누락·N+1·트랜잭션 결함·마이그레이션 위험·SQL 인젝션을 만들지 않는다. 필터 파라미터는 전부 바인딩되어 있고 정렬 컬럼/방향은 기존 이중 화이트리스트로 보호된다. 나머지 변경 파일은 테스트 헬퍼·e2e 계약 검증·문서/plan 산출물로 DB 코드가 아니다. 인덱스 커버리지 관련 INFO 1건은 이 diff 이전부터 있던 상태로 참고 목적으로만 기재했다.

## 위험도
NONE
