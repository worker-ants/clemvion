# 데이터베이스(Database) 리뷰

## 발견사항

- **[INFO]** 마이그레이션 안전성 — NULL 허용 컬럼 추가, 안전한 패턴
  - 위치: `codebase/backend/migrations/V064__integration_usage_log_api_columns.sql`
  - 상세: `ALTER TABLE integration_usage_log ADD COLUMN ... NULL` 3개를 단일 DDL 문으로 실행한다. PostgreSQL 11+ 에서 NULL 허용 컬럼 추가는 테이블 재작성 없이 카탈로그 업데이트만으로 처리되므로 순간 AccessShareLock(읽기 차단 없음) 수준이며 무중단 배포에 안전하다. 마이그레이션 파일에 `backfill 없음` 결정 근거가 명시돼 있어 운영 중 데이터 손실 위험도 없다.
  - 제안: 이미 적절히 설계됨. 별도 조치 불필요.

- **[INFO]** 인덱스 미추가 — 현재 쿼리 패턴 기준 적절
  - 위치: `V064__integration_usage_log_api_columns.sql` (주석 설명 참조)
  - 상세: 마이그레이션 주석에 "현재 활동 탭은 `(integration_id, at DESC)` 만 사용, endpoint별 필터·통계는 별도 PR"이라고 의도가 명시돼 있다. 현재 변경에서 `api_label` / `api_method` / `api_path` 로 WHERE 절 필터링하는 쿼리는 없으므로 인덱스 누락이 현재 문제를 일으키지 않는다. 향후 endpoint별 집계·필터 기능이 추가될 때 `api_label` 인덱스가 필요해질 수 있다.
  - 제안: 현재는 허용. 향후 endpoint 필터/통계 PR에서 `CREATE INDEX CONCURRENTLY` 패턴으로 추가할 것을 권고.

- **[INFO]** ORM 엔티티 — TypeORM 컬럼 매핑 일관성
  - 위치: `codebase/backend/src/modules/integrations/entities/integration-usage-log.entity.ts`
  - 상세: `@Column({ nullable: true })` 로 세 컬럼 모두 선언되어 마이그레이션의 `NULL` 선언과 정확히 일치한다. `varchar` 길이(128/8/256)도 DDL과 동일하게 맞춰져 있다. TypeORM `save()` 흐름에서 서비스 레이어가 미리 `clampApiField`로 길이를 자르므로 DB 레벨 VARCHAR 오버플로 예외가 발생하지 않는다.
  - 제안: 이미 적절히 설계됨.

- **[INFO]** N+1 쿼리 — 해당 없음
  - 상세: 신규 컬럼은 단순 INSERT-only 경로(`usageLogRepository.save`)에만 쓰인다. 활동 탭 조회는 기존 쿼리 그대로이며 반복문 내 개별 쿼리 패턴이 도입되지 않았다. 카탈로그 엔드포인트(`getServiceCatalog`)는 DB를 전혀 조회하지 않고 인메모리 메타데이터(`listAllCafe24Operations()`)를 반환하는 순수 함수이다.
  - 제안: 해당 없음.

- **[INFO]** SQL 인젝션 — 파라미터화 쿼리 사용, 안전
  - 상세: 변경된 코드에서 raw SQL 문자열을 직접 조합하는 경로가 없다. TypeORM 엔티티 기반 `repository.save()` / `repository.create()` 패턴만 사용하며 파라미터 바인딩은 ORM이 처리한다. `database-query.handler.ts`의 `extractSqlVerb`는 로그용 첫 토큰 추출이며 실제 DB 실행과 무관하다.
  - 제안: 해당 없음.

- **[INFO]** 커넥션 관리 — 기존 패턴 유지
  - 상세: 신규 변경이 커넥션을 직접 획득하거나 해제하는 코드를 포함하지 않는다. TypeORM `DataSource` 풀 관리는 기존 모듈 설정을 그대로 사용한다.
  - 제안: 해당 없음.

- **[INFO]** 대량 데이터 — 현재 쿼리 범위 외
  - 상세: 신규 컬럼이 포함되는 조회는 활동 탭 `limit: 20, days: 7` 고정 페이지네이션 범위 내이며 기존 `(integration_id, at DESC)` 인덱스로 커버된다. 카탈로그 엔드포인트는 DB 쿼리가 없으므로 대용량 테이블 성능과 무관하다.
  - 제안: 해당 없음.

## 요약

이번 변경의 DB 관련 핵심은 `integration_usage_log` 테이블에 `api_label`, `api_method`, `api_path` 세 컬럼을 추가하는 마이그레이션(V064)이다. 세 컬럼 모두 NULL 허용으로 선언되어 PostgreSQL 무중단 배포 요건을 충족하며, 기존 행에 대한 backfill 없음 결정이 주석에 명시되어 있다. DDL과 TypeORM 엔티티의 길이 제약이 일치하고, 서비스 레이어에서 사전 clamp 처리를 통해 DB 오버플로 예외를 방지한다. 현재 쿼리 접근 패턴(통합별 최근 20건, 7일 범위) 기준으로 인덱스 추가 생략은 적절한 결정이며, N+1 쿼리·SQL 인젝션·커넥션 누수 등의 문제는 발견되지 않는다. 향후 endpoint 필터·집계 기능이 추가될 때 `api_label`에 `CREATE INDEX CONCURRENTLY` 적용이 필요하다는 점만 유의하면 된다.

## 위험도

LOW
