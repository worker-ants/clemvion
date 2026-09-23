# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 0-affected 경로에서만 발생하는 추가 라운드트립(무락 재조회)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:862-867` (`removeMember`)
  - 상세: `DELETE ... WHERE id=$1 AND workspace_id=$2 AND role != 'owner'` 가 `affected === 0` 이면, 원인(행 소실 vs owner 승격)을 가르기 위해 무락 `findOne` 을 한 번 더 실행한다. 트랜잭션으로 묶지 않고 별도 쿼리로 처리했지만, 이 재조회는 오직 **에러 코드 선택**(403 `CANNOT_REMOVE_OWNER` vs 404 `MEMBER_NOT_FOUND`)에만 쓰이고 데이터를 변경하지 않으므로, 두 쿼리 사이에 상태가 다시 바뀌어도 "그 시점의 유효한 직렬화 결과" 중 하나를 반환하는 것이어서 정합성 훼손은 없다. 이 경로는 동시 `transferOwnership`/동시 제거가 겹치는 드문 경우에만 타므로 정상 경로 성능에 영향 없음.
  - 제안: 현재 설계 유지 권장. plan(`plan/in-progress/member-owner-toctou.md` §B)에서 트랜잭션+비관적 락 대안을 실측 근거로 명시적으로 기각했고(기존 `affected === 0` 판별자가 도달 불가가 되어 죽은 테스트를 만든다는 점), 이는 합리적 트레이드오프다.

- **[INFO]** 원자성 보장이 Postgres 고유 동작(EvalPlanQual)에 의존
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:844-853` (주석) / `854-858` (DELETE 문)
  - 상세: 새 락을 들이지 않고 조건부 `DELETE ... WHERE role != 'owner'` 하나로 TOCTOU 를 막는 근거는 "READ COMMITTED 에서 동시 UPDATE 가 쥔 행 락을 기다렸다가 커밋 후 갱신된 행 버전에 대해 WHERE 를 재평가한다"는 Postgres 특유의 EvalPlanQual 동작이다. 이는 표준 SQL 이 아니라 Postgres 구현 세부사항이므로, 향후 DB 엔진 교체 시 이 보장은 재검증이 필요하다.
  - 제안: 현재로선 문제 없음 — `member-remove-concurrency.e2e-spec.ts` 의 재진입(reentrant) 테스트가 실제 Postgres 인스턴스로 이 메커니즘을 결정론적으로 검증하고 있어(락을 쥔 뒤 관측 가능한 "pending" 상태를 공허성 가드로 확인한 후 승격 UPDATE+COMMIT), mock 이 아닌 실 DB 오라클로 뒷받침된 좋은 선례다. DB 엔진 변경 계획이 생기면 이 가정을 재검토할 것.

- **[INFO]** FindOperator 내부 구조에 결합된 단위 테스트
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts:1509-1515`
  - 상세: `criteria.role.type`/`criteria.role.value` 로 TypeORM `Not()` 의 내부 표현을 직접 검사한다. Jest deep-equality 가 `FindOperator` 를 투명하게 비교하지 못하는 문제를 우회하기 위함이며, 주석에도 그 한계와 "SQL 로 옳게 렌더되는지는 e2e 만 오라클"이라고 명시돼 있다. TypeORM 메이저 버전 업그레이드 시 `FindOperator` 내부 필드명이 바뀌면 이 unit 테스트가 깨질 수 있으나, 파라미터화 여부(SQL 인젝션 안전성) 자체는 e2e(`member-remove-concurrency.e2e-spec.ts`, `session-revocation.e2e-spec.ts` 선례)가 실 DB로 이중 고정하고 있어 리스크가 낮다.
  - 제안: 현행 유지. 별도 조치 불필요.

## 그 외 확인한 항목 (이상 없음)

- **SQL 인젝션**: `Not('owner')` 는 TypeORM `FindOperator` 로 파라미터 바인딩되어 렌더링된다(저장소 내 `delete({expiresAt: LessThan(...)})` · `update({familyId: Not(...)})` 선례 및 실 DB e2e 로 고정). 문자열 결합 없음.
- **인덱스**: DELETE/재조회 모두 `id`(PK, uuid) 등호 조건이 걸려 있어 PK 인덱스로 단일 행 조회다. 추가된 `role != 'owner'` 조건은 비인덱스 컬럼이지만 PK 매치 후 필터링이라 실질 비용 없음. `workspace_member` 는 `@Unique(['workspaceId','userId'])` 도 보유.
- **트랜잭션**: 핵심 정합성(동시 owner 이양 vs 제거)은 새 명시적 트랜잭션 없이 단일 원자 `DELETE` 문 + Postgres 행 락 대기/재평가로 확보한다. 형제 메서드(`deleteWorkspace`/`leaveWorkspace`/`transferOwnership`)의 명시적 트랜잭션+비관적 락 패턴과 다른 메커니즘이지만, 이유가 plan 문서에 실측(기존 단위 테스트 2건/3케이스가 도달 불가가 됨)으로 명시돼 있고 e2e 로 검증됨.
- **마이그레이션 안전성**: 스키마 변경 없음(엔티티·마이그레이션 파일 미포함). 해당 없음.
- **스키마 설계**: 변경 없음.
- **커넥션 관리**: e2e 테스트의 `locker` 커넥션은 `beforeAll`/`afterAll` 로 생명주기 관리되고, 신규 재진입 테스트는 `try/finally` 로 `ROLLBACK` 을 보장해 락이 걸린 채 남지 않는다. 서비스 코드는 리포지토리 패턴만 사용, 수동 커넥션 획득 없음.
- **대량 데이터**: 단일 행 대상 연산(`id` PK 매치)이라 페이지네이션/대용량 스캔과 무관.
- **N+1**: 반복문 내 쿼리 없음.

## 요약

이번 변경(`removeMember` owner 보호 가드의 TOCTOU 수정)은 새 락을 도입하지 않고 조건부 원자 `DELETE ... WHERE role != 'owner'` + `affected === 0` 시 무락 재조회로 원인을 가르는 방식이다. 파라미터화된 TypeORM `FindOperator` 를 사용해 SQL 인젝션 우려가 없고, PK 등호 조건이라 인덱스 사용도 적절하며, 스키마·마이그레이션 변경은 없다. 유일한 설계상 특이점은 원자성 보장이 Postgres 의 EvalPlanQual(락 대기 후 갱신된 행에 대한 WHERE 재평가)이라는 구현 세부사항에 의존한다는 점인데, 이는 plan 문서에서 트랜잭션+비관적 락 대안과 명시적으로 저울질해 실측 근거로 기각됐고, 실제 Postgres 인스턴스를 사용하는 재진입(reentrant) e2e 테스트가 이 메커니즘을 결정론적으로 검증한다. 전반적으로 데이터베이스 관점에서 결함은 발견되지 않았으며, 몇 가지 설계 트레이드오프만 INFO 로 기록한다.

## 위험도

LOW
