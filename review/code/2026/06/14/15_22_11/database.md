# 데이터베이스(Database) 리뷰 결과

## 발견사항

### **[INFO]** partial 인덱스 설계 적절 — trigger_id IS NOT NULL 필터
- 위치: `V096__execution_source_ip_response_code.sql` 라인 70-72
- 상세: `idx_execution_trigger_started` 가 `WHERE trigger_id IS NOT NULL` 조건을 적용해 schedule/manual 실행 행(trigger_id=NULL)을 제외한다. `getUsage` 쿼리가 항상 `trigger_id IN (...)` 조건을 포함하므로 이 partial index가 효율적으로 매칭된다. 인덱스 컬럼 순서 `(trigger_id, started_at DESC)` 도 `WHERE trigger_id IN (...) ORDER BY started_at DESC LIMIT 20` 패턴에 최적이다.
- 제안: 현행 유지. 단, execution 테이블이 장기적으로 대용량화될 경우 `started_at` 범위 파티셔닝을 검토할 수 있으나 현재는 불필요.

### **[INFO]** 마이그레이션 안전성 — nullable 컬럼 추가 + 무중단 배포 적합
- 위치: `V096__execution_source_ip_response_code.sql` 라인 58-60
- 상세: `ADD COLUMN source_ip VARCHAR(45) NULL` 과 `ADD COLUMN response_code VARCHAR(10) NULL` 모두 `NULL DEFAULT` 로 추가된다. PostgreSQL 에서 nullable 컬럼 추가는 테이블 재작성 없이 카탈로그 업데이트만 수행(즉각 반환)하므로 production table rewrite lock 이 없다. 기존 row 는 자동으로 NULL을 가지며 회귀가 없다.
- 제안: 현행 유지.

### **[INFO]** 인덱스 생성 안전성
- 위치: `V096__execution_source_ip_response_code.sql` 라인 70-72
- 상세: `CREATE INDEX IF NOT EXISTS` 를 사용하나 `CONCURRENTLY` 옵션이 없다. 일반 `CREATE INDEX` 는 빌드 중 ShareLock 을 보유해 DML(INSERT/UPDATE/DELETE)을 블록한다. execution 테이블이 활성 write 가 많은 고빈도 테이블이라면 배포 시 순간 write 차단이 발생할 수 있다.
- 제안: 무중단 배포가 요구사항이라면 `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_trigger_started ...` 로 변경을 권장한다. 단, Flyway 기본 트랜잭션 내 실행 시 `CONCURRENTLY` 는 허용되지 않으므로 해당 마이그레이션을 `outOfOrder=true` 또는 별도 non-transactional 마이그레이션(`-- flyway:noTransaction`)으로 분리해야 한다.

### **[INFO]** 기간별 집계 쿼리 — COUNT FILTER 단일 쿼리 패턴 효율적
- 위치: `auth-configs.service.ts` 라인 432-446 (diff 기준)
- 상세: `COUNT(*) FILTER (WHERE e.started_at >= :sinceXX)` 를 단일 쿼리에서 3종 동시에 집계하는 패턴은 PostgreSQL 전용 구문으로 효율적이다. 3회 별도 쿼리 대비 왕복 1회로 집계한다. `Promise.all` 병렬화로 totalCalls/periodRaw/recentExecutions 3개 쿼리를 동시 실행하는 설계도 레이턴시를 최소화한다.
- 제안: 현행 유지. 단, COUNT FILTER 는 PostgreSQL 전용이므로 DB 엔진 이식성이 요구사항이 될 경우 `SUM(CASE WHEN ...)` 패턴으로의 교체를 미리 인지해 둔다(현재 프로젝트에서는 해당 없음).

### **[INFO]** totalCalls 쿼리와 periodRaw 쿼리 간 범위 불일치 가능성
- 위치: `auth-configs.service.ts` (diff 라인 426-453)
- 상세: `totalCalls`(getCount)는 모든 기간의 trigger_id 행을 집계하고, `periodRaw`(getRawOne)는 `trigger_id IN (...)` + `started_at` 범위 필터를 적용한다. 두 쿼리는 독립적으로 실행되며 정합성 이슈는 없다. 단, `totalCalls`의 WHERE 조건은 `trigger_id IN (...)` 만 있어 전체 누적 건수를 반환하는 의도에 부합한다.
- 제안: 현행 설계가 스펙 의도에 부합한다. 명시적 주석이 이미 충분히 문서화되어 있음.

### **[INFO]** VARCHAR(10) response_code 컬럼 크기
- 위치: `V096__execution_source_ip_response_code.sql` 라인 60, `execution.entity.ts` 라인 816-821
- 상세: HTTP 상태 코드는 3자리 숫자이므로 VARCHAR(10)이 충분하다. 향후 커스텀 코드 문자열을 저장하더라도 10자 이내면 문제없다.
- 제안: 현행 유지.

### **[INFO]** N+1 쿼리 없음 확인
- 위치: `auth-configs.service.ts` getUsage 메서드 전체
- 상세: `recentExecutions` 조회 시 `innerJoinAndSelect('e.trigger', 't')` 로 trigger 를 한 번에 JOIN 로드하며, 이후 `e.trigger?.name` 접근이 추가 쿼리를 발생시키지 않는다. N+1 패턴 없음.
- 제안: 현행 유지.

## 요약

이번 변경은 PostgreSQL `execution` 테이블에 nullable 컬럼 2개(`source_ip VARCHAR(45)`, `response_code VARCHAR(10)`)를 추가하고, `(trigger_id, started_at DESC) WHERE trigger_id IS NOT NULL` partial index 를 생성하는 마이그레이션이 핵심이다. nullable 컬럼 추가는 무중단 배포 관점에서 안전하며 기존 row 에 회귀가 없다. 기간별 집계는 `COUNT FILTER` 단일 쿼리 + `Promise.all` 병렬화로 레이턴시를 최소화했고, `innerJoinAndSelect` 로 N+1 문제를 방지하고 있다. 유일한 주의사항은 `CREATE INDEX` 에 `CONCURRENTLY` 가 없다는 점으로, execution 테이블이 고빈도 write 환경이라면 배포 시 순간적인 ShareLock 으로 write 가 차단될 수 있다. 전반적으로 DB 설계와 쿼리 패턴은 양호하다.

## 위험도

LOW

---

STATUS=success ISSUES=1
