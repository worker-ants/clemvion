# 데이터베이스(Database) Review 결과

## 발견사항

### [INFO] COUNT FILTER 집계 — PostgreSQL 전용 문법
- 위치: `auth-configs.service.ts` 변경 diff +443~+454, `getUsage` 메서드 내 periodQb
- 상세: `COUNT(*) FILTER (WHERE ...)` 구문은 PostgreSQL 9.4+ 전용이다. 본 코드베이스가 PostgreSQL 을 단독 RDBMS 로 사용한다면 문제 없으나, 이식성 전제가 바뀔 경우 대체 필요. 현재 마이그레이션 파일(V096)이 PostgreSQL 방언(`COMMENT ON COLUMN`)을 사용하고 있으므로 이미 PostgreSQL 단일 DB 임을 확인, 실질적 위험 없음.
- 제안: 단순 참고. 향후 DB 교체 시 `SUM(CASE WHEN ... THEN 1 ELSE 0 END)` 로 대체.

### [INFO] 부분 인덱스(partial index) — trigger_id=NULL 제외 최적화
- 위치: `V096__execution_source_ip_response_code.sql` L70~L72
- 상세: `WHERE trigger_id IS NOT NULL` 조건의 partial index `idx_execution_trigger_started`는 getUsage 쿼리 패턴(`trigger_id IN (...)`)에 잘 부합한다. `trigger_id IN (:...triggerIds)` 조건은 triggerIds 가 비어 있으면 쿼리가 early-return 으로 skip 되므로 인덱스 활용 경로가 명확하다.
- 제안: 현재 설계 적절. recentQb 의 `ORDER BY started_at DESC LIMIT 20` 도 `(trigger_id, started_at DESC)` 복합 인덱스로 커버되어 별도 filesort 없이 처리 가능. 이상 없음.

### [INFO] 기간 집계 쿼리의 WHERE 절과 인덱스 범위 스캔
- 위치: `auth-configs.service.ts` periodQb (+441~+455)
- 상세: periodQb는 `WHERE e.trigger_id IN (:...triggerIds)` 만 적용하고 started_at 에는 WHERE 절이 없다 — started_at 범위는 SELECT FILTER 조건으로만 사용한다. 이로 인해 인덱스는 `trigger_id` 조건으로 행을 필터링한 후 전체 기간(since30d 이전 행 포함)을 스캔하게 된다. trigger 당 execution 행 수가 수백만 이상 대용량이라면 WHERE에 `e.started_at >= :since30d` 를 추가해 인덱스 범위를 최소화하는 것이 바람직하다. 현재 USAGE_RECENT_CALLS_LIMIT(20)은 recentQb 에만 적용되며, periodQb 에는 LIMIT 없음.
- 제안: 대용량 테이블 대비, periodQb 에 `.andWhere('e.started_at >= :since30d', { since30d: new Date(now - USAGE_PERIOD_WINDOWS_MS.last30d) })` 를 추가하여 인덱스 범위 스캔을 30일 이내로 제한 권장. 현재 규모에서는 INFO 수준이지만, 트래픽 증가 시 WARNING 이 될 수 있다.

### [INFO] getRawOne 반환값의 컬럼 이름 의존
- 위치: `auth-configs.service.ts` +455, +466~+470
- 상세: `getRawOne<{ last24h: string; last7d: string; last30d: string }>()` 는 TypeORM 이 alias(`'last24h'`, `'last7d'`, `'last30d'`)를 snake_case 변환 없이 그대로 반환한다고 가정한다. TypeORM 의 `getRawOne` 은 SELECT alias 를 그대로 raw key 로 돌려주므로 현재 alias 명("last24h" 등 소문자+숫자 조합)은 변환 없이 그대로 매핑된다. `safeUsageCount(periodRaw?.last24h)` 폴백도 구현되어 있어 DB NULL/오류 반환에도 안전하다. 이상 없음.
- 제안: 현재 구현 적절.

### [INFO] 마이그레이션 안전성 — nullable 컬럼 ADD COLUMN
- 위치: `V096__execution_source_ip_response_code.sql` L58~L60
- 상세: `ALTER TABLE execution ADD COLUMN source_ip VARCHAR(45) NULL, ADD COLUMN response_code VARCHAR(10) NULL;` 는 두 컬럼 모두 nullable+default null 이다. PostgreSQL 11+ 에서 nullable+no-default `ADD COLUMN` 은 테이블 재작성(full table rewrite) 없이 카탈로그 업데이트만으로 완료되므로 무중단 배포에 안전하다. 기존 행은 자동 NULL, 신규 INSERT 는 명시 없으면 NULL — 회귀 없음.
- 제안: 현재 마이그레이션 설계 적절.

## 요약

이번 변경은 `execution` 테이블에 `source_ip`(VARCHAR 45)·`response_code`(VARCHAR 10) 두 nullable 컬럼을 추가하고, getUsage 쿼리를 3개 독립 쿼리(Promise.all 병렬화)로 리팩터링하며 기간별 집계를 COUNT FILTER 단일 쿼리로 처리한다. 마이그레이션은 nullable 컬럼 추가로 무중단 안전하고, 부분 인덱스(`idx_execution_trigger_started`)는 trigger_id IN 조건과 started_at DESC 정렬 양쪽을 커버한다. 단 periodQb 에 started_at 하한 WHERE 조건이 없어 대용량 테이블에서 인덱스 범위 스캔이 불필요하게 넓어질 수 있으며, COUNT FILTER 는 PostgreSQL 전용 문법임을 확인했다(현재 코드베이스 기준 문제 없음). N+1 문제 없음, 트랜잭션 불필요한 조회 전용 로직, SQL 인젝션 위험 없음(파라미터화된 쿼리), 커넥션 관리는 TypeORM Repository/QueryBuilder 위임으로 적절하다.

## 위험도

LOW
