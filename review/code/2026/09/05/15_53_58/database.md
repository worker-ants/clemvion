# 데이터베이스(Database) 리뷰

## 범위 요약

이번 changeset 에서 DB 와 실질적으로 관련된 코드는 `codebase/backend/src/modules/audit-logs/audit-logs.service.ts`
(및 대응하는 `audit-logs.spec.ts` 단위 테스트) 하나뿐이다. `AuditLogsService.findAll` 의 조회 쿼리를

- 이전: `.leftJoinAndSelect('al.user', 'user')` — `User` 엔티티 전 컬럼 로드
- 이후: `.leftJoin('al.user', 'user').addSelect(['user.id', 'user.name', 'user.email'])` — 3필드만 로드

로 좁힌 것이 핵심 변경이다. 반환 타입도 `AuditLogListItem`(= `Omit<AuditLog,'user'|'workspace'> & { user: Pick<User,'id'|'name'|'email'>|null }`)으로 좁혀 타입이 런타임 select 범위와 일치하게 했다.

나머지 파일은 다음과 같이 DB 코드와 무관하다.
- `response-contract.ts`/`.spec.ts`, `execution-response.dto.spec.ts`: 런타임 HTTP 응답 객체와 OpenAPI 스키마를 대조하는 테스트 헬퍼로, repository·query builder·트랜잭션 API 를 전혀 사용하지 않는다(직접 grep 확인: `repository`/`createQueryBuilder`/`transaction`/`@Entity`/`@Index` 0건).
- 4개 e2e 스펙(`audit-logs`, `session-revocation`, `workflow-crud`, `workflow-execution`): 기존 e2e 흐름에 `assertMatchesContract` 호출만 추가. 새 DB 쿼리·커넥션 사용 없음.
- `CHANGELOG.md`, `plan/in-progress/*.md`, `review/**/*.md`, `*.json`: 문서/산출물, 스키마·쿼리와 무관.

## 발견사항

- **[INFO]** `addSelect` 로 좁힌 조인은 DB 관점에서 순정 개선이며 새 결함을 만들지 않음
  - 위치: `codebase/backend/src/modules/audit-logs/audit-logs.service.ts:65-66` (`.leftJoin('al.user', 'user').addSelect(['user.id', 'user.name', 'user.email'])`)
  - 상세: 8개 점검 관점 전수 확인.
    - **인덱스**: 필터 조건(`workspace_id`, `action`, `resource_type`, `user_id`, `created_at` 범위)과 정렬 컬럼은 이 diff 로 바뀌지 않았다. `workspace_id`+`created_at` 조합은 `codebase/backend/migrations/V002__indexes.sql` 의 `idx_audit_log_workspace_created (workspace_id, created_at DESC)` 복합 인덱스로 이미 커버된다.
    - **N+1**: 여전히 단일 `QueryBuilder` 쿼리(`getCount()` 1회 + `getMany()` 1회)로, 반복문 내 개별 쿼리 없음. `user` 는 `leftJoin`+`addSelect` 로 같은 쿼리에서 함께 조회되므로 N+1 로 퇴행하지 않았다.
    - **트랜잭션**: `findAll` 은 읽기 전용. `getCount()`/`getMany()` 두 쿼리 사이 짧은 시간차로 total count 와 페이지 데이터가 미세하게 어긋날 수 있는 이론적 여지는 이 diff 이전부터 있던 기존 패턴이며, 이번 변경이 새로 도입한 정합성 리스크는 아니다.
    - **마이그레이션 안전성**: 스키마 변경 없음(select 절만 변경) — 무중단 배포 리스크 없음.
    - **스키마 설계**: 테이블 구조·관계 변경 없음.
    - **커넥션 관리**: `@InjectRepository`로 주입된 `Repository<AuditLog>` 그대로 사용, 커넥션 풀은 TypeORM/NestJS 가 관리 — 변경 없음.
    - **SQL 인젝션**: `addSelect` 배열은 사용자 입력이 아닌 하드코딩 컬럼명 리터럴이다. 나머지 필터는 전부 `:workspaceId`/`:action`/`:resourceType`/`:userId`/`:startDate`/`:endDate` 파라미터 바인딩을 그대로 유지한다. `order.toUpperCase() as 'ASC'|'DESC'`·`sort` 는 이 diff 가 건드리지 않은 `getSortColumn` 화이트리스트(`created_at`/`action`/`resource_type` 외 값은 `created_at`로 폴백)로 보호된다.
    - **대량 데이터**: `offset`/`limit` 페이지네이션 방식은 변경 없음. 오히려 select 컬럼이 26개(User 전 컬럼, `details` 류 큰 텍스트/시크릿 포함 가능)에서 3개로 줄어 행당 전송량이 줄었으므로 대량 조회 시 네트워크/직렬화 부담이 감소하는 부수 이득이 있다.
  - 제안: 없음 — 그대로 유지 권장.

- **[INFO]** (diff 범위 밖, 참고용) `action`/`resource_type`/`user_id` 단독 필터 조합 전용 인덱스는 없음
  - 위치: `codebase/backend/src/modules/audit-logs/entities/audit-log.entity.ts` (전체 파일, `@Index` 데코레이터 0건)
  - 상세: 이번 diff 는 필터/인덱스 구조를 전혀 건드리지 않았다. 워크스페이스별 감사 로그가 대량으로 누적되고 `action`/`resource_type`/`user_id` 조합으로 자주 필터링된다면 `(workspace_id, created_at)` 외 추가 복합 인덱스가 필요할 수 있으나, 이는 기존 상태로 이 diff 가 만든 문제가 아니다.
  - 제안: (선택) 별도 plan 항목으로 트래픽 프로파일 확인 후 검토.

## 요약

이번 changeset 의 DB 관련 실질 변경은 감사 로그 목록 조회에서 `leftJoinAndSelect` → `leftJoin`+`addSelect` 로 select 컬럼을 3개로 좁힌 것 하나이며(응답에 `User` 전 컬럼— 비밀번호 해시·2FA 복구 코드 등 자격증명 포함 — 이 노출되던 보안 결함의 근본 수정), DB 관점에서도 새로운 인덱스 누락·N+1·트랜잭션 결함·마이그레이션 위험·SQL 인젝션을 전혀 도입하지 않는다. 오히려 컬럼 축소로 전송량이 줄어드는 부수 이득이 있다. 필터 파라미터는 전부 바인딩되어 있고 정렬 컬럼/방향은 기존 화이트리스트로 이중 보호된다. 나머지 변경 파일(테스트 헬퍼, e2e 계약 검증, 문서/plan/review 산출물)은 DB 코드가 아니다. 인덱스 커버리지 관련 INFO 1건은 diff 이전부터 있던 상태로 참고용으로만 기재했다.

## 위험도
NONE
