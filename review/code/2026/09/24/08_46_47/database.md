# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** `affected === 0` 경로에서만 도는 추가 무락 재조회 — 데이터 정합성엔 영향 없음
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:859-873` (`removeMember`)
  - 상세: `DELETE ... WHERE id=$1 AND workspace_id=$2 AND role != 'owner'`(854-858)가 0행이면 원인(행 소실 vs owner 승격)을 가르려고 `findOne`(863-865)을 한 번 더 실행한다. 트랜잭션으로 묶지 않았지만 이 재조회는 **에러 코드 선택**(403 `CANNOT_REMOVE_OWNER` vs 404 `MEMBER_NOT_FOUND`)에만 쓰이고 아무 것도 쓰지 않으므로, 두 쿼리 사이 상태가 다시 바뀌어도 "그 시점의 유효한 직렬화 결과" 중 하나를 반환하는 것이라 정합성 훼손은 없다. 이 라운드에서 분기 조건이 `still?.role === 'owner'` → `if (still)`(871)로 바뀌었는데, 이는 순수 인메모리 판정 변경이라 쿼리 형태·트랜잭션 경계에는 영향이 없다(제3 상태 오분류를 고친 것 — 동시성 관점 사안이지 DB 관점 결함은 아니다).
  - 제안: 현재 설계 유지. `plan/in-progress/member-owner-toctou.md` §B가 트랜잭션+비관적 락 대안을 실측 근거(#1373의 `affected === 0` 판별자가 도달 불가가 됨)로 명시적으로 기각한 것이 문서화돼 있어 합리적 트레이드오프다.

- **[INFO]** 원자성 보장이 Postgres 고유 동작(EvalPlanQual)에 의존
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.ts:841-853`(주석) / `854-858`(DELETE 문)
  - 상세: 새 락을 들이지 않고 조건부 `DELETE ... WHERE role != 'owner'` 하나로 TOCTOU를 막는 근거는 "READ COMMITTED에서 동시 UPDATE가 쥔 행 락을 기다렸다가 커밋 후 갱신된 행 버전에 대해 WHERE를 재평가한다"는 Postgres 특유의 EvalPlanQual 동작이다. 표준 SQL이 아니라 구현 세부사항이므로 DB 엔진 교체 시 재검증이 필요하다.
  - 제안: 현재로선 문제 없음 — `codebase/backend/test/member-remove-concurrency.e2e-spec.ts`의 재진입(reentrant) 테스트(209-294)가 실 Postgres 인스턴스로 이 메커니즘을 결정론적으로 검증한다(락을 쥔 뒤 `VACUITY_GUARD_MS` 공허성 가드로 "pending" 관측 → 승격 UPDATE + COMMIT). 이번 라운드에 이 테스트가 공유 workspace 대신 전용 `createTeamWorkspace`로 격리됐고(210-214), 대기 상수도 `test/helpers/concurrency.ts`의 `export const VACUITY_GUARD_MS`(31)로 중앙화됐다 — 둘 다 테스트 위생 개선이며 DB 메커니즘 자체에는 변화가 없다. DB 엔진 변경 계획이 생기면 이 가정을 재검토할 것.

- **[INFO]** FindOperator 내부 구조에 결합된 단위 테스트 (이전 라운드에서 이미 확인, 이번 diff로 재현)
  - 위치: `codebase/backend/src/modules/workspaces/workspaces.service.spec.ts` (변경분 없음 — 이번 프롬프트에는 유닛 diff가 포함되지 않았으나 전 라운드 지적이 유효)
  - 상세: `Not('owner')`가 SQL로 파라미터화돼 렌더링되는지는 unit이 아니라 `codebase/backend/test/member-remove-concurrency.e2e-spec.ts`의 신규 재진입 e2e(고치기 전 200 → 고친 뒤 403, 행 유지 확인)와 `session-revocation.e2e-spec.ts` 선례가 실 DB 오라클로 고정한다.
  - 제안: 현행 유지. 별도 조치 불필요.

## 그 외 확인한 항목 (이상 없음)

- **SQL 인젝션**: `Not('owner')`는 TypeORM `FindOperator`로 파라미터 바인딩되어 렌더링된다(저장소 내 `delete({expiresAt: LessThan(...)})` 등 선례 및 실 DB e2e로 고정). e2e 헬퍼(`member-remove-concurrency.e2e-spec.ts:224-227`, `371-373`)의 raw SQL도 전부 `$1`/`$2` 파라미터 바인딩이고 문자열 결합이 없다.
- **인덱스**: DELETE·재조회 모두 `id`(PK, uuid) 등호 조건이라 PK 인덱스로 단일 행 조회다. 추가된 `role != 'owner'` 조건은 비인덱스 컬럼이지만 PK 매치 후 필터라 실질 비용 없음. `workspace_member`는 `@Unique(['workspaceId','userId'])`도 보유(엔티티 변경 없음).
- **트랜잭션**: 핵심 정합성(동시 owner 이양 vs 제거)은 새 명시적 트랜잭션 없이 단일 원자 `DELETE` 문 + Postgres 행 락 대기/재평가로 확보한다. 형제 메서드(`deleteWorkspace`/`leaveWorkspace`/`transferOwnership`, 각각 트랜잭션+`pessimistic_write`)와 메커니즘이 다르지만 plan 문서(`member-owner-toctou.md` §B)에 실측 근거(락 안 재조회 시 기존 단위 테스트 2건/3케이스가 도달 불가가 됨)로 명시적으로 저울질돼 있고 e2e로 검증된다.
- **마이그레이션 안전성**: 이번 diff에 스키마·마이그레이션 파일 변경 없음. 해당 없음.
- **스키마 설계**: 변경 없음(`workspace-member.entity.ts` 미변경 확인).
- **커넥션 관리**: e2e의 `locker`/`db` 커넥션은 `beforeAll`/`afterAll`로 생명주기 관리되고(기존 패턴 재사용, 신규 커넥션 생성 없음), 신규 재진입 테스트는 `try/finally`로 `ROLLBACK`을 보장해(`.catch(() => undefined)`로 이중 방어) 락이 걸린 채 커넥션이 남지 않는다.
- **대량 데이터**: 단일 행 대상 연산(`id` PK 매치)이라 페이지네이션·대용량 스캔과 무관.
- **N+1**: 반복문 내 쿼리 없음 — `affected === 0`일 때만 조건부로 1회 추가 쿼리가 도는 구조이지 반복 구조가 아니다.

## 요약

이번 라운드는 `removeMember()`의 owner TOCTOU 수정(조건부 원자 `DELETE ... WHERE role != 'owner'` + `affected` 재해석)을 그대로 유지한 채, 직전 리뷰(`review/code/2026/09/24/08_09_57`) WARNING 대응으로 (1) `still` 재조회 판정을 `still?.role === 'owner'` → `if (still)`로 고쳐 제3 상태(강등된 행) 오분류를 없앴고, (2) 신규 재진입 e2e를 전용 workspace로 격리했고, (3) 공허성 가드 상수 `VACUITY_GUARD_MS`를 export해 재사용한 것이 핵심 diff다. 세 변경 모두 DB 쿼리 형태·트랜잭션 경계·인덱스 사용에는 영향이 없는 인메모리 로직/테스트 위생 개선이며, 파라미터화된 쿼리·PK 기반 조회·명시적 커넥션 정리 등 기존에 확인된 안전한 패턴이 그대로 유지된다. 스키마·마이그레이션 변경도 없다. 데이터베이스 관점에서 결함은 발견되지 않았고, 이미 문서화된 설계 트레이드오프(Postgres EvalPlanQual 의존, 무락 재조회)만 INFO로 재확인한다.

## 위험도

LOW
