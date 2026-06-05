# 데이터베이스(Database) 리뷰 결과

## 발견사항

### 발견사항 1

- **[INFO]** `active_running_ms` 컬럼 추가: `NOT NULL DEFAULT 0` — 안전한 무중단 마이그레이션
  - 위치: `codebase/backend/migrations/V073__execution_active_running_ms.sql`
  - 상세: `ALTER TABLE execution ADD COLUMN IF NOT EXISTS active_running_ms INTEGER NOT NULL DEFAULT 0`는 PostgreSQL에서 안전한 패턴이다. `DEFAULT` 상수값을 가진 `NOT NULL` 컬럼은 PostgreSQL 11+에서 테이블 재작성(table rewrite) 없이 메타데이터 변경만으로 처리된다. `IF NOT EXISTS`로 멱등성도 확보되어 있다.
  - 제안: 현재 구현 그대로 유지. 추가 조치 불필요.

### 발견사항 2

- **[INFO]** `active_running_ms` 컬럼 타입 선택 (INTEGER vs BIGINT)
  - 위치: `codebase/backend/migrations/V073__execution_active_running_ms.sql` L138, `codebase/backend/src/modules/executions/entities/execution.entity.ts` L988
  - 상세: `INTEGER(int4)` 최대값은 약 2.1×10⁹ ms(≈24일)이다. 기본 한도 1.8×10⁶ ms(30분)에 비해 충분한 여유가 있고, 마이그레이션 주석에도 `int4` 상한을 명시하여 근거가 문서화되어 있다. 기존 `duration_ms`와 동일 타입을 사용해 일관성도 있다.
  - 제안: 현재 구현 적절. `maxActiveRunningMs=0`(무제한)으로 운용할 경우 누적값이 이론적으로 int4 범위를 초과할 수 있으나, 단일 execution이 24일 이상 active-running 상태를 유지하는 것은 실질적으로 불가능하므로 허용 가능한 리스크.

### 발견사항 3

- **[INFO]** `active_running_ms` 누적 업데이트 — 빈번한 row UPDATE 패턴
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `updateExecutionStatus` 메서드 (L8290 인근)
  - 상세: RUNNING 진입/이탈(상태전이)마다 `execution.activeRunningMs`를 누적하고 이후 `dataSource.transaction`에서 row를 save한다. 상태전이는 세그먼트당 최소 2회(진입·이탈) 발생하므로, execution당 업데이트 횟수는 노드 수에 비례하지 않고 세그먼트 수에 비례하여 제한적이다. 기존 status/finishedAt 업데이트와 같은 트랜잭션 안에서 처리되므로 별도 쿼리 오버헤드가 없다.
  - 제안: 현재 구현 적절.

### 발견사항 4

- **[INFO]** `segmentStartMs` in-memory Map — 다중 인스턴스(서비스 수평 확장) 환경 고려
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L500
  - 상세: `segmentStartMs`는 인스턴스 내 메모리 Map이다. 세그먼트 시작·종료가 동일 인스턴스 내에서 처리되는 구조(worker가 job을 전체 처리)라면 문제없다. 마이그레이션 주석에도 "세그먼트는 한 인스턴스 안에서 처리되므로 in-memory Map으로 충분(누적값은 row에 영속)"이라 명시되어 있다. BullMQ 구조상 job 단위 처리이므로 인스턴스 간 분할이 발생하지 않는 것으로 판단된다.
  - 제안: 현재 설계 적절. 추후 인스턴스 간 job 분할이 생기는 아키텍처 변경 시 `active_running_ms`의 영속 값만으로 누적하도록 로직 변경 필요.

### 발견사항 5

- **[INFO]** TypeORM entity 컬럼 선언 — 마이그레이션과 일치
  - 위치: `codebase/backend/src/modules/executions/entities/execution.entity.ts` L988
  - 상세: `@Column({ name: 'active_running_ms', type: 'int', default: 0 })` 선언이 V073 마이그레이션의 `INTEGER NOT NULL DEFAULT 0`과 정확히 대응한다. `nullable` 없이 `default: 0`이므로 entity 레벨에서도 NOT NULL 의미가 보존된다.
  - 제안: 현재 구현 적절.

## 요약

이번 변경의 DB 관련 핵심은 `execution` 테이블에 `active_running_ms INTEGER NOT NULL DEFAULT 0` 컬럼을 추가하는 V073 마이그레이션이다. `ADD COLUMN ... DEFAULT <상수>`는 PostgreSQL 11+에서 table lock 없이 메타데이터만 변경되므로 무중단 배포에 안전하며, `IF NOT EXISTS`로 멱등성이 확보되어 있다. TypeORM entity 선언과 마이그레이션이 일치하고, 누적 업데이트는 기존 status 업데이트 트랜잭션에 통합되어 별도 쿼리 오버헤드가 없다. SQL 인젝션, N+1 쿼리, 인덱스 누락, 커넥션 관리 측면의 문제는 없다. 전체적으로 DB 관점의 위험 사항이 없는 안정적인 변경이다.

## 위험도

NONE
