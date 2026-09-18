# 데이터베이스(Database) 리뷰

## 검토 방법

`codebase/backend/migrations/V112~V116` (신규 FK 인덱스 5개, `.sql`+`.conf` 쌍)과 신규 e2e
(`codebase/backend/test/deletion-cascade-indexes.e2e-spec.ts`), 관련 `spec/1-data-model.md` ·
`spec/data-flow/{3-execution,5-integration,7-llm-usage}.md` 갱신을 검토했다. 저장소 파일을 뮤테이션하지
않고, 다음을 직접 열어 대조했다:

- `codebase/backend/migrations/V111__trigger_workflow_id_index.{sql,conf}` (직전 선례) — V112~V116 의
  구조(주석 헤더·`DROP INDEX CONCURRENTLY IF EXISTS` 선행·`executeInTransaction=false`·수동 롤백 주석)와
  1:1 대조
- `migrations/README.md` §5 (`.conf` 파일당 `CREATE INDEX CONCURRENTLY` 정확히 1개 컨벤션)
- `node-execution.entity.ts` (`node_id` → `Node`, `onDelete: 'CASCADE'`), `V008__integration_usage_log_and_metadata.sql`
  (`node_execution_id`·`workflow_id` 모두 `NOT NULL … ON DELETE CASCADE`), `V014__llm_usage_logs.sql`
  (`execution_id`·`node_execution_id` 모두 nullable `… ON DELETE SET NULL`) — 다섯 인덱스의 선두 컬럼·partial
  조건이 실제 FK 방향·nullable 여부와 일치하는지 확인
- `python3 scripts/check-migration-versions.py --base origin/main` 실행 — `OK: 116 migration(s), max V116, base=origin/main.`
- 기존 마이그레이션 전수(`V002`·`V008`·`V014`·`V034`·`V095`)에 동일 선두 컬럼 인덱스가 이미 있는지 grep —
  중복/불필요 인덱스 없음을 확인
- `test/helpers/db.ts` — e2e 커넥션 라이프사이클(단일 `Client`, `beforeAll`/`afterAll` 로 명시적 open/close)

## 발견사항

(CRITICAL·WARNING 없음)

- **[INFO]** 로그 테이블 두 곳(`integration_usage_log`, `llm_usage_log`)의 쓰기 비용이 애초 리뷰 시점(`review/consistency/2026/09/18/13_44_08`)에는 "추론"으로 남아 있었으나, 최종 상태(`plan/in-progress/spec-draft-deletion-cascade-indexes.md` `## 실측 > 쓰기 비용`, `spec/1-data-model.md` 신규 Rationale 절)에는 `node_execution` 과 동일 절차(10만 행 INSERT ×5, median)로 실측한 수치(1,080.7→1,188.6 ms · 1,500.5→1,635.3 ms)가 채워져 있다.
  - 위치: `spec/1-data-model.md` `## Rationale > ### 삭제 연쇄의 FK 인덱스 다섯` (신규 절, unified diff 라인 990~996 부근 — 쓰기 비용 표)
  - 상세: consistency checker 가 지적한 WARNING("따로 잰다"는 선행 Rationale 예고를 추론으로 대체)이 이미 실측으로 해소된 상태로 이번 리뷰 대상에 포함되어 있음을 DB 관점에서도 재확인. 지적할 결함 없음 — 기록만 남긴다.
  - 제안: 없음(이미 해소).

## 준수 확인 (참고 — 위반 아님)

- **인덱스 선정**: 다섯 인덱스 모두 실제 FK 방향과 일치 — `node_execution.node_id`(CASCADE, `node.entity.ts` `onDelete: 'CASCADE'`), `integration_usage_log.{node_execution_id,workflow_id}`(둘 다 `NOT NULL` CASCADE, `V008`), `llm_usage_log.{node_execution_id,execution_id}`(둘 다 nullable SET NULL, `V014`). partial 조건(`WHERE … IS NOT NULL`)은 nullable 컬럼 둘에만 적용되고 NOT NULL 컬럼 셋에는 없음 — 과다·과소 적용 없음.
- **중복/불필요 인덱스 없음**: `node_execution` 기존 `(execution_id)`(V002)·`(execution_id, node_id, started_at DESC)`(V034)·`(execution_id, status) WHERE …`(V095) 중 어느 것도 선두가 `node_id` 가 아니라 이번 FK 조회에 못 쓰인다(spec 이 명시). `integration_usage_log`·`llm_usage_log` 기존 인덱스도 선두 컬럼이 겹치지 않는다 — grep 으로 신규 5개와 충돌·중복 없음을 확인.
- **마이그레이션 안전성**: `CREATE/DROP INDEX CONCURRENTLY` + `.conf executeInTransaction=false` — ACCESS EXCLUSIVE 락 없이 무중단 인덱스 생성(SHARE UPDATE EXCLUSIVE 만 취득, 동시 DML 차단 안 함). `CREATE` 앞에 `DROP INDEX CONCURRENTLY IF EXISTS`(invalid 잔재 정리, README §5 컨벤션과 V111 선례 그대로) — `CONCURRENTLY` 중도 실패 시 이름만 점유한 invalid 인덱스가 `IF NOT EXISTS` 재실행에서 영구히 스킵되는 것을 막는다. 파일당 `CREATE` 정확히 1개(README §5 제한) 준수.
- **검증 e2e**: `indisvalid` 까지 단언(`pg_get_indexdef` 존재만이 아니라 유효성까지) + 선두 컬럼·partial 조건을 정규식으로 대조 — `CREATE INDEX CONCURRENTLY` 실패 잔재를 초록으로 통과시키지 않는 설계. 파라미터화 쿼리(`$1`) 사용, SQL 인젝션 여지 없음.
- **커넥션 관리**: e2e 는 `beforeAll`에서 단일 `Client.connect()`, `afterAll`에서 `db.end()` — 누수 없음.
- **마이그레이션 버전**: `check-migration-versions.py --base origin/main` 로컬 실행 결과 `OK: 116 migration(s), max V116` — 중복·gap 없음.
- **대량 데이터**: 800k `node_execution` / 80k `integration_usage_log` / 160k `llm_usage_log` 규모로 실측(캔버스 노드 삭제 206.6→0.79 ms, 워크플로 삭제 2,225→6.96 ms) — CONCURRENTLY 로 빌드하므로 인덱스 생성 자체가 서비스 중단을 유발하지 않고, 생성 후 삭제 경로 성능이 선형(테이블 크기 × 연쇄 행 수)에서 상수에 가깝게 개선됨을 확인.
- **애플리케이션 코드**: 엔티티 `@Index` 데코레이터 추가 없이 순수 SQL 마이그레이션 — 선례(V111, trigger)와 동일 패턴. N+1·트랜잭션 관련 애플리케이션 코드 변경 자체가 없어 해당 관점은 적용 대상 아님.

## 요약

`node_execution`·`integration_usage_log`·`llm_usage_log` 세 로그/이력 테이블에 걸린 FK 다섯 개에 선두 인덱스를 추가하는 순수 인덱스 마이그레이션(V112~V116)이다. 각 인덱스의 선두 컬럼·partial 조건을 실제 엔티티/마이그레이션의 FK 방향(CASCADE vs SET NULL)·nullable 여부와 직접 대조한 결과 전부 일치했고, 기존 인덱스와의 중복도 없었다. `CREATE/DROP INDEX CONCURRENTLY` + 비-트랜잭션 `.conf` + invalid 잔재 선(先) 제거는 직전 선례(V111)와 정확히 같은, 검증된 무중단 패턴이다. `check-migration-versions.py` 로컬 실행도 통과(max V116, 중복/gap 없음). 신규 e2e 는 존재뿐 아니라 `indisvalid`와 인덱스 정의(선두 컬럼·partial 조건)까지 검증해 `CONCURRENTLY` 실패 잔재를 가려내는 설계다. 실측(800k 규모, 워크플로 삭제 2,225→6.96 ms 등)과 쓰기 비용 트레이드오프(행당 +0.85~1.35 µs)가 모두 문서화돼 있어 데이터베이스 관점에서 CRITICAL/WARNING 급 결함을 발견하지 못했다.

## 위험도

NONE
