# 데이터베이스(Database) 리뷰 결과

## 발견사항

- **[INFO]** 마이그레이션 무중단 배포 안전성 — ADD COLUMN nullable
  - 위치: `codebase/backend/migrations/V085__execution_user_variables.sql` L81–82
  - 상세: `ALTER TABLE execution ADD COLUMN user_variables JSONB NULL` 은 PostgreSQL 11+ 에서 DEFAULT 없이 nullable 컬럼을 추가할 때 테이블 재작성이 발생하지 않는다. 기존 행은 NULL 이 되며 명시적 default null 설계와 일치한다. 배타적 AccessExclusiveLock 은 짧은 시간 내에 해제되므로 대용량 `execution` 테이블에서도 무중단 배포에 적합하다.
  - 제안: 현재 패턴은 안전하다. (만약 나중에 DEFAULT 값이 필요해지면 `ADD COLUMN ... DEFAULT <v>` + 별도 backfill 단계로 분리하는 expand-contract 패턴을 유지할 것.)

- **[INFO]** JSONB 컬럼 인덱스 미생성
  - 위치: `V085__execution_user_variables.sql`
  - 상세: `user_variables` 컬럼에 대한 GIN 인덱스가 마이그레이션에 포함되지 않았다. 변경 코드와 커밋 설명을 보면 이 컬럼은 park→rehydration 경로에서 단일 `execution` 행을 PK 로 조회한 뒤 컬럼 값을 읽는 용도다. JSONB 내부 키 검색 쿼리(`@>`, `->`) 없이 전체 오브젝트를 읽기만 하므로 GIN 인덱스는 현재 불필요하다.
  - 제안: 현재 액세스 패턴에서는 추가 인덱스 없이 충분하다. 향후 `user_variables` 내부 키로 필터링하는 쿼리가 생기면 GIN 인덱스(`CREATE INDEX CONCURRENTLY`)를 별도 마이그레이션으로 추가한다.

- **[INFO]** 트랜잭션 원자성 — staging 패턴
  - 위치: `execution-engine.service.ts` `stageDurableResumeSnapshot` + `updateExecutionStatus` 호출 3곳 (lines ~3502, ~5112, ~6089)
  - 상세: `stageDurableResumeSnapshot` 은 엔티티 객체의 필드만 변경(in-memory mutation)하고, 직후 `updateExecutionStatus`(트랜잭션 내 TypeORM save) 가 실제 DB 에 commit 한다. thread 와 user_variables 가 동일 트랜잭션으로 묶이므로 정합성은 보장된다. 이 패턴은 V084 conversation_thread 와 동일하며 검증된 구조다.
  - 제안: 현재 패턴은 적절하다.

- **[INFO]** SQL 인젝션 — JSONB 저장 경로
  - 위치: `execution.entity.ts` `@Column({ type: 'jsonb' })` + TypeORM 저장
  - 상세: TypeORM 을 통해 파라미터화된 쿼리로 저장되므로 SQL 인젝션 위험 없음. `user_variables` 값은 애플리케이션 레이어에서 plain object 로 직렬화된 후 TypeORM 드라이버가 바인딩 처리한다.
  - 제안: 해당 없음.

- **[INFO]** 대량 데이터 — JSONB 컬럼 크기
  - 위치: `stageDurableResumeSnapshot`, `rehydrateUserVariables`
  - 상세: park 직전 `context.variables` 에서 `__*` 시스템 키를 제외한 사용자 정의 변수만 저장한다. 워크플로우 실행 중 사용자 변수가 매우 많거나 값이 대형 JSON 오브젝트인 경우 JSONB 컬럼 크기가 커질 수 있다. 그러나 이는 현재 설계 의도(사용자 변수 전체 보존)에 내재된 트레이드오프이며, PostgreSQL TOAST 가 8 KB 초과 JSONB 를 자동 처리한다.
  - 제안: 운영 중 `user_variables` 크기가 이슈가 된다면 저장 전 size-cap 검사를 추가할 것을 고려한다. 현재 단계에서는 MEDIUM 이상 위험 없음.

## 요약

이번 변경은 `execution` 테이블에 `user_variables JSONB NULL` 컬럼을 추가(V085)하고, 엔진이 park 시 사용자 정의 변수를 해당 컬럼에 원자적으로 commit 하며 rehydration 시 복원하는 패턴을 구현한다. 마이그레이션은 nullable ADD COLUMN 으로 무중단 배포에 안전하고, 저장·복원 모두 기존 트랜잭션(updateExecutionStatus) 에 편승하므로 추가 DB 왕복·정합성 리스크가 없다. TypeORM 파라미터 바인딩으로 SQL 인젝션도 없다. 현재 액세스 패턴은 PK 단건 조회 후 컬럼 전체 읽기이므로 별도 인덱스 불필요. 전반적으로 DB 관점에서 위험 요소는 발견되지 않았다.

## 위험도

NONE
