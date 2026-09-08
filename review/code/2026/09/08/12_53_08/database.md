# Database Review

## 발견사항

- **[INFO]** `listMembers` 를 DB 레벨 `select` 투영으로 전환 — 긍정적 변경 (N+1 없음, 컬럼 최소화)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232` (`listMembers`)
  - 상세: 기존에는 `relations: ['user']` 로 `User` 전 컬럼을 로드한 뒤 JS 단 `.map` 으로 6키만 골랐다. 이번 변경은 `find()` 옵션에 `select: { id, userId, role, joinedAt, user: { id, email, name } }` 를 추가해 DB 레벨에서 컬럼을 좁힌다. `relations: ['user']` 와 `select.user` 를 함께 써서 여전히 단일 LEFT JOIN 쿼리로 유지되므로 N+1 을 유발하지 않는다. `where: { workspaceId }` 는 그대로이고 페이지네이션은 이 쿼리에 없지만 그것은 이 diff 가 새로 만든 게 아니라 기존 동작이며(워크스페이스 멤버 수는 통상 소규모), 이번 변경 범위에서 지적할 결함은 아니다.
  - 제안: 없음(개선). 다만 워크스페이스 멤버 수가 장기적으로 매우 커질 가능성이 있다면 별도 항목으로 페이지네이션 도입을 검토할 것 — 이번 diff 의 필수 사항은 아니다.

- **[INFO]** 전역 예외 필터가 unique-violation 판정을 로컬 구현에서 공용 SoT(`pg-error.ts`)로 이전 — 실질적 버그 수정
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:12` (import), `:70` (`isPostgresUniqueViolation(exception)`)
  - 상세: 기존 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해 `err.driverError.code` 표면만 인식했다. `pg-error.ts` 의 `isPostgresUniqueViolation`/`pgErrorCode` 는 `err.code` 와 `err.driverError.code` 두 표면을 모두 검사하므로, wrap 되지 않은 raw 23505 도 이제 409 `RESOURCE_CONFLICT` 로 정확히 분류된다. 새 spec(`http-exception.filter.spec.ts`)이 두 표면(래핑됨/raw)과 non-23505 negative case 를 모두 커버해 이 변경의 유효성을 검증한다. DB 에러 매핑의 SoT 일원화로 향후 새 서비스가 유사한 국소 판정을 재작성해 또 다른 좁은 사본을 만드는 것을 막는다.
  - 제안: 없음(개선).

- **[INFO]** `integration-oauth.service.ts` 의 손-작성 constraint 추출 로직을 `pgErrorConstraint()` 헬퍼로 교체 — 순수 리팩터, 동작 동일
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (diff 상 두 자리, 게이트 `1268-1274`, `1822-1828` — cafe24/makeshop 설치 경로)
  - 상세: 종전 코드가 `err.constraint ?? err.driverError?.constraint` 를 두 곳에서 손으로 반복하던 것을 `pgErrorConstraint(err)` 단일 호출로 교체했다. 추출 로직이 정확히 동일해 기능적 차이는 없다. `isPostgresUniqueViolation(err) && pgErrorConstraint(err) === STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 조합으로 특정 UNIQUE 인덱스 위반만 좁혀 409 로 매핑하는 패턴이 유지되어, 다른 제약 위반을 오분류할 위험이 없다.
  - 제안: 없음.

- **[INFO]** 신규 AST 가드(`endpoint-path-conflict-wrap-guard.ts`/`.spec.ts`) — `triggerRepository.save()` 호출이 UNIQUE 충돌 래핑을 빠뜨리지 않도록 하는 래칫
  - 위치: `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap-guard.ts` (신규), `codebase/backend/src/repo-guards/__tests__/endpoint-path-conflict-wrap.spec.ts` (신규)
  - 상세: `(workspace_id, endpoint_path)` UNIQUE 인덱스를 건드리는 저장 경로(`create`/`update`)만 `rethrowEndpointPathConflict` 로 감싸져 있고 나머지 6개 저장 경로는 그 컬럼을 건드리지 않아 지금은 안전하다는 것을 화이트리스트로 고정한다. 새 저장 경로가 추가되면 테스트가 실패해 작성자가 래핑 여부를 결정하도록 강제한다 — DB 제약 위반이 미가공 500 으로 새는 것을 구조적으로 방지하는 좋은 패턴이다. 순수 정적 스캔이라 런타임 DB 접근이나 트랜잭션·커넥션 이슈는 없다.
  - 제안: 없음.

- **[INFO]** 신규 e2e(`webhook-trigger.e2e-spec.ts` B4) — 실제 Postgres UNIQUE 제약을 타는 경로 커버리지 추가
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213` (`it('B4. ...')`)
  - 상세: 동일 워크스페이스에 같은 `endpointPath` 로 두 번째 트리거 생성을 시도해 실제 DB 의 `(workspace_id, endpoint_path)` UNIQUE 인덱스 위반 → 409 + `details.field`/`details.code` 매핑 → 드라이버 원문 미노출(`not.toContain('duplicate key')`)까지 단언한다. 기존 단위 테스트는 `QueryFailedError` 를 mock 으로 만들었을 뿐이라 실제 드라이버 에러 형태(제약 이름·SQLSTATE)가 그 mock 과 일치하는지 검증하지 못했던 갭을 메운다. DB 관점에서 바람직한 보강이다.
  - 제안: 없음.

- **[INFO]** 마이그레이션 파일 변경 없음 / SQL 인젝션 위험 없음
  - 상세: 이번 diff 에는 스키마 마이그레이션 변경이 없다(무중단 배포 안전성 항목은 해당 없음). 모든 쿼리가 TypeORM `find()`/`select`/`relations` 선언형 옵션을 사용하며 raw SQL 문자열 조립이 없어 SQL 인젝션 표면이 없다. 커넥션 풀·트랜잭션 관리 변경도 이번 diff 범위에는 없다.

## 요약

이번 변경 집합의 DB 관련 부분은 전부 개선 방향이다 — (1) `pg-error.ts` 를 SoT 로 통일해 raw 표면 23505 가 500 으로 새던 실질 결함을 닫았고, (2) `listMembers` 를 JS 단 매핑에서 DB 레벨 `select` 투영으로 전환해 민감 컬럼이 애초에 로드되지 않도록 강제(방어를 검출에서 강제로 승격)했으며 여전히 단일 JOIN 쿼리로 N+1 을 유발하지 않고, (3) `endpointPath` UNIQUE 충돌 래핑 누락을 잡는 정적 래칫과 (4) 실제 DB 제약을 타는 e2e 를 신설해 회귀 방지 커버리지를 넓혔다. 스키마 마이그레이션 변경이 없어 무중단 배포 위험은 해당 없고, 모든 쿼리가 파라미터화된 ORM 호출이라 SQL 인젝션 위험도 없다. 트랜잭션·커넥션 풀 관리에 새로운 우려는 발견되지 않았다. CRITICAL/WARNING 급 발견사항 없음.

## 위험도

NONE
