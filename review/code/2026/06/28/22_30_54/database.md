# 데이터베이스(Database) 리뷰 결과

## 발견사항

### [INFO] `getStatusById` 공개 API 캡슐화 — private bracket access 제거
- **위치**: `codebase/backend/src/modules/executions/executions.service.ts` (신규 메서드 `getStatusById`, 약 699-704라인)
- **상세**: `hooks.service.ts` 가 `this.executionsService['executionRepository']?.findOne?.()` 로 private 레포지터리에 bracket access 하던 코드를 `getStatusById(executionId)` 공개 메서드 위임으로 교체했다. 신규 메서드는 `findOne({ where: { id }, select: ['id', 'status'] })` 로 필요한 컬럼만 선택하며, `.catch(() => null)` 으로 조회 실패를 흡수한다. 인덱스 측면에서 PK(`id`) 로 단건 조회이므로 추가 인덱스가 불필요하다.
- **제안**: 현재 구현 적절. 다만 `catch(() => null)` 이 DB 연결 오류 등 예상 외 오류도 조용히 흡수한다는 점을 운영 로그로 보완하면 더 좋다 (옵션).

### [INFO] `extractClientIpFromHeaders` 반환형 `null → undefined` 통일
- **위치**: `codebase/backend/src/modules/auth/utils/client-ip.ts` (반환형 변경)
- **상세**: DB 쿼리와 무관한 순수 함수 타입 변경이다. `sourceIp` 컬럼에 `undefined` 가 전달되면 TypeORM 은 해당 컬럼을 UPDATE 대상에서 제외(column omit)하거나 `NULL` 로 저장하는 동작이 ORM 설정에 따라 달라질 수 있다. 그러나 이 값은 `ExecutionEngineService.execute()` options 로만 전달되고, 실제 INSERT 시 `undefined` 를 받으면 대부분의 TypeORM 설정에서 `NULL` 로 저장된다. `null` → `undefined` 전환 전후 behavior가 동일하게 `NULL` 컬럼 저장으로 귀결되므로 실질적 DB 영향은 없다.
- **제안**: 이상 없음.

### [INFO] `QueryFailedError` 23505 처리 — 예외 필터 레벨 분기 (테스트만 변경)
- **위치**: `codebase/backend/src/common/filters/http-exception.filter.spec.ts` (신규 테스트 케이스)
- **상세**: PostgreSQL unique 제약 위반(code `23505`)을 `QueryFailedError` 로 포착해 409 RESOURCE_CONFLICT 로 매핑하는 예외 필터 동작을 단위 테스트로 검증한다. 실제 필터 구현 변경은 이번 diff 에 포함되지 않으나, 기존 구현이 이 경로를 지원함을 테스트로 문서화한다. 드라이버 원문(컬럼·제약명)이 응답에 노출되지 않는 것을 검증하는 어서션이 포함되어 CWE-209 보호를 단위 수준에서 확인한다.
- **제안**: 이상 없음. 추가로 MySQL의 unique violation code(`1062`)도 지원이 필요한 경우 해당 분기도 테스트에 포함하면 좋다.

### [INFO] `hooks.service.spec.ts` — mock ExecutionsService 구조 변경
- **위치**: `codebase/backend/src/modules/hooks/hooks.service.spec.ts`
- **상세**: `getStatusById` 공개 메서드 추가에 따라 테스트 mock 이 `executionRepository.findOne` 위임을 유지하면서 `getStatusById` 를 래핑하는 IIFE 패턴으로 변경됐다. DB 로직 자체의 변경이 아니라 테스트 인프라 조정이다.
- **제안**: 이상 없음.

## 요약

이번 변경의 DB 관련 핵심은 두 가지다. (1) `HooksService.getActiveExecutionStatus()` 가 `ExecutionsService` 의 private 레포지터리 bracket access를 통해 직접 DB 조회하던 패턴을 `getStatusById()` 공개 메서드로 캡슐화했다 — PK 단건 조회(`id` + `status` 선택) 로 불필요한 컬럼 로딩이 없으며 인덱스도 이미 PK로 커버된다. (2) `extractClientIpFromHeaders` 반환형을 `null → undefined` 로 통일하여 `sourceIp` 컬럼 저장 로직의 `?? undefined` 중복 연산자를 제거했다 — `undefined` 와 `null` 모두 TypeORM 에서 `NULL` 저장으로 귀결되므로 스키마·데이터 영향 없다. 마이그레이션 없음, N+1 없음, SQL 인젝션 위험 없음(파라미터화 쿼리 사용), 트랜잭션 변경 없음. 전체적으로 DB 위험도가 없는 안전한 리팩터링이다.

## 위험도

NONE

---

STATUS=success ISSUES=0
