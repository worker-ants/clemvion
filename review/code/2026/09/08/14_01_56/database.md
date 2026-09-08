# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[INFO]** `listMembers` 를 JS 단 수동 매핑에서 DB 레벨 `select` 투영으로 전환 — 긍정적 변경(N+1 없음, 컬럼 최소화, 민감 컬럼 로드 자체 차단)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts` 함수 `listMembers` (`select:` 블록 추가부)
  - 상세: 종전에는 `relations: ['user']` 로 `User` 전 컬럼(민감 7컬럼 포함)을 단일 LEFT JOIN 으로 로드한 뒤 `.map` 으로 6키만 골랐다. 이번 변경은 같은 `find()` 호출에 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 를 추가해 DB 레벨에서 컬럼을 좁힌다. `relations`+`select` 조합은 TypeORM 이 여전히 단일 JOIN 쿼리로 처리하므로 추가 쿼리(N+1)를 유발하지 않는다. 방어가 "JS 매핑에 의한 검출"에서 "쿼리 자체의 강제"로 승격된 것으로, 순수하게 개선이다. 신설 테스트(`workspaces.service.spec.ts` — "쿼리가 `user` 관계를 `select` 로 좁혀 요청한다")가 `select.user` 가 boolean 이 아니라 객체인지까지 검증해, 투영이 되돌아가도 반환 키 단언만으로는 못 잡는 회귀를 별도 축으로 고정했다.
  - 제안: 조치 불요. 다만 `where: { workspaceId }` 뒤에 `.find()` 를 그대로 쓰고 있어 이 쿼리 자체에는 페이지네이션이 없다 — 이는 이번 diff 가 새로 만든 것이 아니라 기존 동작이고, 워크스페이스 멤버 수는 통상 소규모라 즉시 문제는 아니지만 대규모 조직 도입 시 별도 항목으로 검토할 가치는 있다(이번 PR 필수 사항 아님).

- **[INFO]** 전역 예외 필터의 unique-violation 판정을 로컬 구현에서 SoT(`pg-error.ts`)로 통합 — raw 표면(`err.code`, `QueryFailedError` 로 감싸이지 않은 형태) 23505 도 이제 전역적으로 409 `RESOURCE_CONFLICT` 로 응답한다
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts` — `isUniqueViolation` 로컬 함수 제거 후 `isPostgresUniqueViolation(exception)` 사용 (`@Catch()` 필터의 else-if 분기)
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해, TypeORM 이 감싸지 않은 raw 표면 23505 는 이 분기를 타지 못하고 500 `INTERNAL_ERROR` 로 떨어졌다. 신설 `isPostgresUniqueViolation`(`codebase/backend/src/common/db/pg-error.ts`)은 `err.code ?? err.driverError?.code` 두 표면을 모두 보므로, `GlobalExceptionFilter` 를 거치는 **모든** 엔드포인트에서 이 매핑이 넓어진다. Plan(`plan/in-progress/spec-followups-batch-b.md` B-3)·CHANGELOG 가 "실측한 blast radius 는 0"(우리 스키마를 치는 raw query 가 요청 경로에 없음)이라고 명시했고, 회귀 테스트(`http-exception.filter.spec.ts` 신설 2건)가 양방향(raw 23505 → 409 / raw 23502 → 500)을 고정해 넓힌 판이 아무 에러나 409 로 만들지 않는지도 검증한다. DB 에러 매핑 SoT 일원화로 향후 서비스가 국소 판정을 재작성해 또 다른 좁은 사본을 만드는 것도 막는다.
  - 제안: 조치 불요(의도된 버그 수정). 상태 코드가 전역적으로 넓어지는 변경이므로 CHANGELOG 기록은 이미 되어 있고 이 정도로 충분하다.

- **[INFO]** `integration-oauth.service.ts` 의 손-작성 `constraint` 추출(`err.constraint ?? err.driverError?.constraint`, 두 자리에 반복)을 `pgErrorConstraint()` 헬퍼로 교체 — 동작 동일한 순수 리팩터, 중복 제거
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (cafe24/makeshop 설치 경로 두 곳, `isPostgresUniqueViolation(err) && pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 조합)
  - 상세: 추출 로직이 `pg-error.ts` 의 `pgErrorConstraint` 와 정확히 동일해 기능 차이 없음. 특정 UNIQUE 인덱스 위반만 좁혀 409 로 매핑하는 기존 패턴을 그대로 유지하므로 다른 제약 위반을 오분류할 위험도 없다.
  - 제안: 조치 불요.

- **[INFO]** 신설 e2e(`webhook-trigger.e2e-spec.ts` B4) — 실제 Postgres `(workspace_id, endpoint_path)` UNIQUE 제약을 타는 경로 커버리지 추가
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts` — `it('B4. 같은 워크스페이스에 같은 endpointPath → 409 RESOURCE_CONFLICT + details.code (§1.10)', ...)`
  - 상세: 기존 단위 테스트(`triggers.service.spec.ts`)는 `QueryFailedError` 를 손으로 만들어 `rethrowEndpointPathConflict` 를 태웠을 뿐, 실 드라이버 에러 형태(제약 이름·SQLSTATE)가 그 mock 과 일치하는지는 검증하지 못했다. 이 e2e 는 실 DB UNIQUE 위반 → 409 + `details: { field, code }` 매핑 → 드라이버 원문(`duplicate key`) 비노출까지 함께 단언해, mock-vs-실물 갭을 메운다. DB 관점에서 견고한 계약 커버리지 강화다.
  - 제안: 조치 불요.

- **[INFO]** 신설 AST 정적 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`/fixture) — `triggerRepository.save()` 저장 경로가 UNIQUE 충돌 래핑(`rethrowEndpointPathConflict`)을 빠뜨리면 실패하는 화이트리스트 래칫
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (신규), `endpoint-path-conflict-wrap.spec.ts` (신규), `endpoint-path-save.fixture.ts` (신규)
  - 상세: 순수 정적 스캔(`typescript` AST)이라 런타임 DB 접근·트랜잭션·커넥션 이슈는 없다. `(workspace_id, endpoint_path)` UNIQUE 인덱스를 건드리는 저장 경로가 미래 추가될 때 래핑 여부를 사람이 명시적으로 결정하도록 강제하는 방어적 장치로, DB 제약 위반이 미가공 500 으로 새는 것을 구조적으로 막는 좋은 패턴이다.
  - 제안: 조치 불요.

- **[INFO]** 마이그레이션 변경 없음 / SQL 인젝션 위험 없음 / 트랜잭션·커넥션 풀 변경 없음
  - 상세: 이번 diff(25개 파일, B-1~B-8)에는 스키마 마이그레이션 파일이 없다 — 무중단 배포 안전성 항목은 해당 없음. 모든 DB 접근이 TypeORM `find()`/`select`/`relations` 선언형 옵션이거나 에러 객체의 필드(`err.code`/`err.constraint`) 읽기이며, raw SQL 문자열 조립이 없어 SQL 인젝션 표면이 없다. `workflow-versions.service.ts` 의 `WorkflowVersionDetail` → `WorkflowVersionDetailProjection` 개명은 타입 식별자 변경일 뿐 쿼리 자체(기존 `select` 투영)는 그대로다.

## 요약

이번 변경 집합(B-1~B-8)의 DB 관련 부분은 전부 개선 또는 중립 방향이다. 핵심은 두 가지다 — (1) `pg-error.ts` 를 SoT 로 통일해 raw 표면 23505 unique violation 이 500 으로 새던 실질 결함을 전역 예외 필터에서 닫았고(blast radius 실측 0, 회귀 테스트로 양방향 고정), (2) `WorkspacesService.listMembers` 를 JS 단 매핑에서 DB 레벨 `select` 투영으로 전환해 `User` 민감 컬럼이 애초에 로드되지 않도록 방어를 검출에서 강제로 승격했으며 여전히 단일 JOIN 쿼리로 N+1 을 유발하지 않는다. 그 외 `integration-oauth.service.ts` 의 constraint 추출 헬퍼 치환은 순수 리팩터, 신설 AST 가드와 e2e 테스트는 UNIQUE 제약 위반 처리 경로의 회귀 방지 커버리지를 넓힌다. 마이그레이션 변경이 없어 무중단 배포 위험은 해당 없고, 모든 쿼리가 파라미터화된 ORM 선언형 호출이라 SQL 인젝션 위험도 없다. 트랜잭션·커넥션 풀 관리에 새로운 우려는 발견되지 않았다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
