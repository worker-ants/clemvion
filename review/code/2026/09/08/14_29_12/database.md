# 데이터베이스(Database) 코드 리뷰

## 발견사항

- **[INFO]** `listMembers` — DB 레벨 `select` 투영으로 전환, N+1 없이 단일 쿼리 유지
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:213-232`
  - 상세: `memberRepository.find({ where, relations: ['user'], select: { id, userId, role, joinedAt, user: { id, email, name } } })` 형태. TypeORM 의 `relations`(array 스타일) + 중첩 `select` 조합은 여전히 단일 LEFT JOIN 쿼리로 처리되고 별도 호출을 만들지 않는다 — N+1 로 퇴화하지 않는다. 종전에는 `relations: ['user']` 로 `User` 전 컬럼(민감 7컬럼 포함, `passwordHash` 등)을 로드한 뒤 `.map` 으로 6키만 골랐는데, 이제 DB 레벨에서부터 3컬럼(`id, email, name`)만 로드한다 — 네트워크·메모리 전송량이 줄고, 방어 층이 "JS 매핑"에서 "쿼리 자체"로 내려와 더 견고하다. `where: { workspaceId }` 조건 자체(인덱스 사용 여부)는 이번 diff 가 건드리지 않았다.
  - 제안: 조치 불요 — 순수 개선.

- **[INFO]** `http-exception.filter.ts` — unique-violation 판정을 `instanceof QueryFailedError` 요구에서 구조적(duck-typing) 판정으로 확장
  - 위치: `codebase/backend/src/common/filters/http-exception.filter.ts:70` (`isPostgresUniqueViolation(exception)`), 정의는 `codebase/backend/src/common/db/pg-error.ts:18-30`
  - 상세: 종전 로컬 `isUniqueViolation` 은 `err instanceof QueryFailedError` 를 먼저 요구해 TypeORM 이 감싸지 않은 raw 표면(`err.code === '23505'`)의 unique 위반을 500 으로 마스킹했다. 신설 `isPostgresUniqueViolation`/`pgErrorConstraint`(SoT: `pg-error.ts`)는 `instanceof` 없이 `err.code ?? err.driverError?.code` 구조만 검사하므로, `GlobalExceptionFilter` 를 거치는 모든 엔드포인트에서 이제 두 표면 모두 409 로 간다. 회귀 테스트(`http-exception.filter.spec.ts:127-159`)가 raw-23505→409 / raw-23502→500 양방향을 고정했고, CHANGELOG 가 "raw query 가 요청 경로에 없어 실측 blast radius 는 0" 이라고 명시한다. DB 관점에서 남는 잔여 위험은, 구조적 판정이라 Postgres 가 아닌 임의 객체가 우연히 `code: '23505'` 필드를 갖고 있으면(예: 외부 라이브러리 에러) 409 로 오분류될 수 있다는 점인데, `23505` 는 흔한 값이 아니고 두 방향 회귀 테스트가 이미 경계를 고정하고 있어 실질 위험은 낮다.
  - 제안: 조치 불요 — 의도된 SoT 통합이며 회귀 테스트로 방향성이 고정됨.

- **[INFO]** `integration-oauth.service.ts` — 손으로 짠 constraint 추출 로직을 공유 헬퍼 `pgErrorConstraint()` 로 치환, 두 콜사이트 모두 동일 로직으로 수렴
  - 위치: `codebase/backend/src/modules/integrations/integration-oauth.service.ts` (import 및 두 콜사이트, cafe24/makeshop 각각 `STORE_IDENTIFIER_UNIQUE_CONSTRAINT` 비교 분기)
  - 상세: 종전 `(err as {...})?.constraint ?? (err as {...})?.driverError?.constraint` 손-작성 표현이 두 콜사이트에 각각 존재했는데, `pgErrorConstraint(err)` 로 치환됐다. `pg-error.ts` 의 구현과 대조한 결과 동일한 `e.constraint ?? e.driverError?.constraint` 폴백 로직이라 행동 변화 없음(순수 중복 제거). cafe24/makeshop 두 spec 파일의 `it.each` 파라미터화(`raceErrorSurfaces` — flat/wrapped 두 표면)로 이 콜사이트가 실제로 두 표면 모두에서 `CAFE24_PRIVATE_APP_ALREADY_CONNECTED` 로 번역됨을 검증한다.
  - 제안: 조치 불요.

- **[INFO]** 신규 e2e(`webhook-trigger.e2e-spec.ts` B4) — 실 Postgres UNIQUE 제약(`(workspace_id, endpoint_path)`)을 실제로 밟아 409 계약을 검증
  - 위치: `codebase/backend/test/webhook-trigger.e2e-spec.ts:181-213`
  - 상세: 기존 단위 테스트(`triggers.service.spec.ts`)는 `QueryFailedError` 를 손으로 만들어 목 처리만 검증했는데, 실 DB 드라이버가 그 형태(제약 이름·SQLSTATE)를 실제로 돌려주는지는 mock 이 원리적으로 검증할 수 없다. 이 e2e 는 실제 UNIQUE 인덱스를 두 번째 INSERT 로 밟아 409/`RESOURCE_CONFLICT`/`details:{field, code}` 를 확인하고, 드라이버 원문(`'duplicate key'`)이 응답에 새지 않는지도 함께 단언한다 — DB 에러 마스킹 계약을 실 경로로 고정하는 견고한 테스트.
  - 제안: 조치 불요 — 커버리지 개선.

- **[INFO]** 이번 diff 에 스키마 변경(migration)·트랜잭션 로직 변경·커넥션 관리 변경·raw SQL 신설이 없음
  - 상세: grep 확인 결과 `migration`/`ALTER TABLE`/`CREATE TABLE`/`CREATE INDEX` 패턴이 diff 어디에도 없다. 쿼리는 모두 TypeORM `Repository.find`/`findOne` 의 파라미터화된 `where`/`select` 옵션 객체를 통하며, 문자열 결합으로 SQL 을 구성하는 자리는 없다 — SQL 인젝션 표면 없음. `listMembers`·`findOne`(workflow-versions) 둘 다 요청당 단일 쿼리이고 반복문 안에서 쿼리를 호출하는 패턴은 없다(N+1 없음). 대량 데이터·페이지네이션 관점에서 `listMembers` 는 여전히 워크스페이스 전체 멤버를 한 번에 로드하지만 이는 이번 diff 가 만든 변경이 아니라 기존 동작이 유지된 것이다.
  - 제안: 조치 불요(정보성 확인).

## 요약

이번 배치(B-1~B-8)에서 실제로 데이터베이스 계층에 닿는 변경은 크지 않다 — (1) `listMembers` 를 DB 레벨 `select` 투영으로 전환해 `User` 민감 컬럼의 과다 로드를 쿼리 단에서부터 차단했고(단일 쿼리 유지, N+1 없음, 성능도 개선), (2) `http-exception.filter.ts`/`integration-oauth.service.ts` 가 손으로 흩어져 있던 Postgres 에러 코드/제약명 추출 로직을 `pg-error.ts` SoT 로 통합해 raw 표면 unique violation 이 더 이상 500 으로 새지 않도록 고쳤으며, (3) 신규 e2e·spec 파라미터화가 이 변화를 실 DB 경로와 두 에러 표면(flat/wrapped) 모두에서 회귀 고정했다. 스키마 마이그레이션·트랜잭션 경계·커넥션 풀 설정을 건드리는 변경은 없고, 모든 쿼리가 TypeORM 파라미터화 API 를 사용해 SQL 인젝션 표면도 없다. Critical/Warning 급 데이터베이스 결함은 발견되지 않았다.

## 위험도

NONE
